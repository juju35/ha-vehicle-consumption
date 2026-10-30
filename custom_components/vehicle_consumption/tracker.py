"""Vehicle Consumption: distance, fuel and energy used, trips, months, refuels and charges of one vehicle.

The tracker only sees levels (litres or kWh in the tank / battery) and the odometer, never a flow:
- a level that drops is consumption (`ref - new`), and the drop becomes the new reference;
- a level that rises by at least the threshold is a refuel / charge, and the rise becomes the new reference;
- a smaller rise is sensor noise (temperature, slope, recalibration): the reference stays, so the next drop is
  measured from the level before the noise and nothing is counted twice.
Distance is the odometer delta. A trip starts when the odometer moves and ends `trip_gap` minutes after it last
moved; a trip, a month and the total are deltas of the same accumulators (distance, fuel, energy, cost).
Cost is counted when the fuel / energy is consumed, at the price of that moment.

With a home charger energy counter, home charges are measured at the charger (losses included): a session is the
counter going up, until it has not moved for `CHARGER_SESSION_GAP`; a battery rise while the counter moves is that
session, not another charge. Battery rises while the charger is idle stay charges of their own (away from home).
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Iterable
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta
from functools import partial
from typing import Any

from homeassistant.const import ATTR_UNIT_OF_MEASUREMENT, STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import CALLBACK_TYPE, Event, EventStateChangedData, HomeAssistant, State, callback
from homeassistant.helpers.event import async_track_state_change_event, async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import (
    CHARGER_OVERLAP,
    CHARGER_SESSION_GAP,
    CONF_BATTERY_CAPACITY,
    CONF_BATTERY_ENERGY,
    CONF_BATTERY_LEVEL,
    CONF_CHARGE_THRESHOLD,
    CONF_CHARGER_ENERGY,
    CONF_ELECTRICITY_PRICE,
    CONF_ELECTRICITY_PRICE_ENTITY,
    CONF_FUEL_LEVEL,
    CONF_FUEL_PRICE,
    CONF_FUEL_PRICE_ENTITY,
    CONF_FUEL_QUANTITY,
    CONF_ODOMETER,
    CONF_REFUEL_THRESHOLD,
    CONF_TANK_CAPACITY,
    CONF_TRIP_GAP,
    DEFAULT_CHARGE_THRESHOLD,
    DEFAULT_HISTORY_DAYS,
    DEFAULT_REFUEL_THRESHOLD,
    DEFAULT_TRIP_GAP,
    KIND_ELECTRIC,
    KIND_FUEL,
    KIND_PLUGIN_HYBRID,
    MAX_CHARGER_STEP,
    MAX_EVENTS,
    MAX_MONTHS,
    MAX_ODOMETER_JUMP,
    MAX_TRIPS,
    MIN_DISTANCE,
    SAVE_DELAY,
    SENSOR_KEYS,
    STORAGE_KEY,
    STORAGE_VERSION,
)

_LOGGER = logging.getLogger(__name__)

KM_PER_MILE = 1.609344
LITERS_PER_GALLON = 3.785411784  # US gallon
# Rises of the same refuel / charge reported in steps (a car charging reports every few minutes) are merged
# into one event while nothing was consumed in between and the previous step is this recent.
MERGE_WINDOW = timedelta(hours=12)
# Trip gap while replaying hourly statistics: one reading an hour, so an hour still is not a stop yet.
HOURLY_TRIP_GAP = timedelta(minutes=61)

FUEL = "fuel"
ENERGY = "energy"
SOURCE_AUTO = "auto"
SOURCE_CHARGER = "charger"


def _float(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number and abs(number) != float("inf") else None  # no NaN / inf


def _round(value: float | None, digits: int) -> float | None:
    return None if value is None else round(value, digits)


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _time(value: Any) -> datetime | None:
    return dt_util.parse_datetime(str(value)) if value else None


_DISTANCE_FACTORS: dict[str | None, float] = {"mi": KM_PER_MILE, "m": 0.001}
_ENERGY_FACTORS: dict[str | None, float] = {"Wh": 0.001, "MWh": 1000.0, "kJ": 1 / 3600, "MJ": 1 / 3.6}
# Factor turning each source's unit into km / L / kWh (any other unit is taken as is).
_UNIT_FACTORS: dict[str, dict[str | None, float]] = {
    CONF_ODOMETER: _DISTANCE_FACTORS,
    CONF_FUEL_QUANTITY: {"gal": LITERS_PER_GALLON},
    CONF_BATTERY_ENERGY: _ENERGY_FACTORS,
    CONF_CHARGER_ENERGY: _ENERGY_FACTORS,
}


@dataclass(slots=True)
class Totals:
    """Accumulators: what a trip, a month and the whole tracking period are made of."""

    distance: float = 0.0  # km
    fuel: float = 0.0  # L consumed
    energy: float = 0.0  # kWh consumed
    cost: float | None = None  # None until something was consumed with a known price

    def add_cost(self, amount: float) -> None:
        self.cost = (self.cost or 0.0) + amount

    def minus(self, other: Totals) -> Totals:
        cost = None if self.cost is None else self.cost - (other.cost or 0.0)
        return Totals(self.distance - other.distance, self.fuel - other.fuel, self.energy - other.energy, cost)

    def copy(self) -> Totals:
        return Totals(self.distance, self.fuel, self.energy, self.cost)

    def summary(self) -> dict[str, Any]:
        """Rounded figures for the card: consumption and cost per km need a meaningful distance."""
        enough = self.distance >= MIN_DISTANCE
        return {
            "distance": round(self.distance, 1),
            "fuel": round(self.fuel, 2),
            "energy": round(self.energy, 2),
            "fuel_consumption": round(self.fuel / self.distance * 100, 1) if enough else None,
            "energy_consumption": round(self.energy / self.distance * 100, 1) if enough else None,
            "cost": _round(self.cost, 2),
            "cost_per_km": round(self.cost / self.distance, 3) if enough and self.cost is not None else None,
        }

    @classmethod
    def load(cls, data: dict[str, Any] | None) -> Totals:
        data = data or {}
        return cls(
            distance=_float(data.get("distance")) or 0.0,
            fuel=_float(data.get("fuel")) or 0.0,
            energy=_float(data.get("energy")) or 0.0,
            cost=_float(data.get("cost")),
        )


@dataclass(slots=True)
class Trip:
    """A drive: from the first odometer move to the last one before a `trip_gap` pause."""

    start: datetime
    end: datetime | None  # last odometer move; None while driving (stored as the last move)
    totals: Totals

    def summary(self) -> dict[str, Any]:
        return {"start": _iso(self.start), "end": _iso(self.end), **self.totals.summary()}

    def dump(self) -> dict[str, Any]:
        return {"start": _iso(self.start), "end": _iso(self.end), **asdict(self.totals)}

    @classmethod
    def load(cls, data: dict[str, Any]) -> Trip | None:
        start = dt_util.parse_datetime(str(data.get("start")))
        if start is None:
            return None
        end = dt_util.parse_datetime(str(data["end"])) if data.get("end") else None
        return cls(start, end, Totals.load(data))


@dataclass(slots=True)
class Refill:
    """A refuel (litres) or a charge (kWh): from the levels (`auto`), the home charger (`charger`) or by hand."""

    time: datetime
    amount: float
    cost: float | None
    price: float | None
    odometer: float | None
    source: str
    start: datetime | None = None  # start of a home charger session

    def summary(self, unit_key: str) -> dict[str, Any]:
        return {
            "time": self.time.isoformat(),
            "odometer": _round(self.odometer, 1),
            unit_key: round(self.amount, 2),
            "cost": _round(self.cost, 2),
            "price": _round(self.price, 3),
            "source": self.source,
        }

    def dump(self) -> dict[str, Any]:
        return {**asdict(self), "time": self.time.isoformat(), "start": _iso(self.start)}

    @classmethod
    def load(cls, data: dict[str, Any]) -> Refill | None:
        time = dt_util.parse_datetime(str(data.get("time")))
        amount = _float(data.get("amount"))
        if time is None or amount is None:
            return None
        return cls(
            time=time,
            amount=amount,
            cost=_float(data.get("cost")),
            price=_float(data.get("price")),
            odometer=_float(data.get("odometer")),
            source=str(data.get("source") or SOURCE_AUTO),
            start=_time(data.get("start")),
        )


@dataclass(slots=True)
class _Level:
    """Reference level of one kind (fuel L / energy kWh) and its refuel / charge events."""

    ref: float | None = None
    events: list[Refill] = field(default_factory=list)  # newest first
    # Something was consumed since the last automatic event: a new rise is then a new event, not more of the last.
    consumed_since_event: bool = True
    seen: datetime | None = None  # last reading: a rise happened between it and the next one


@dataclass(slots=True)
class _Charger:
    """Home charger energy counter: last reading and the current (or last) session."""

    last: float | None = None  # kWh
    last_move: datetime | None = None  # last time the counter went up
    session_start: datetime | None = None  # None: no session open
    session_amount: float = 0.0  # kWh delivered by the open session

    def dump(self) -> dict[str, Any]:
        return {
            "last": self.last,
            "last_move": _iso(self.last_move),
            "session_start": _iso(self.session_start),
            "session_amount": self.session_amount,
        }

    @classmethod
    def load(cls, data: dict[str, Any] | None) -> _Charger:
        data = data or {}
        return cls(
            last=_float(data.get("last")),
            last_move=_time(data.get("last_move")),
            session_start=_time(data.get("session_start")),
            session_amount=_float(data.get("session_amount")) or 0.0,
        )


class ConsumptionTracker:
    """Distance, consumption, cost, trips, months, refuels and charges of one vehicle."""

    def __init__(self, hass: HomeAssistant, entry_id: str, name: str, options: dict[str, Any]) -> None:
        self.hass = hass
        self.entry_id = entry_id
        self.name = name
        self.sensors: dict[str, str] = {
            key: entity_id for key in SENSOR_KEYS if isinstance(entity_id := options.get(key), str) and entity_id
        }
        self.tank_capacity = _positive(options.get(CONF_TANK_CAPACITY))
        self.battery_capacity = _positive(options.get(CONF_BATTERY_CAPACITY))
        self.fuel_price_entity: str | None = options.get(CONF_FUEL_PRICE_ENTITY) or None
        self.electricity_price_entity: str | None = options.get(CONF_ELECTRICITY_PRICE_ENTITY) or None
        self.fixed_fuel_price = _positive(options.get(CONF_FUEL_PRICE))
        self.fixed_electricity_price = _positive(options.get(CONF_ELECTRICITY_PRICE))
        self.trip_gap = timedelta(minutes=float(options.get(CONF_TRIP_GAP, DEFAULT_TRIP_GAP)))
        self.refuel_threshold = float(options.get(CONF_REFUEL_THRESHOLD, DEFAULT_REFUEL_THRESHOLD))
        self.charge_threshold = float(options.get(CONF_CHARGE_THRESHOLD, DEFAULT_CHARGE_THRESHOLD))

        self.tracks_fuel = CONF_FUEL_QUANTITY in self.sensors or CONF_FUEL_LEVEL in self.sensors
        self.tracks_energy = CONF_BATTERY_ENERGY in self.sensors or CONF_BATTERY_LEVEL in self.sensors
        # Only with a battery, and read first: a battery rise is then checked against an up-to-date counter.
        if self.tracks_energy and isinstance(charger := options.get(CONF_CHARGER_ENERGY), str) and charger:
            self.sensors = {CONF_CHARGER_ENERGY: charger, **self.sensors}

        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY.format(entry_id=entry_id))
        self._listeners: list[CALLBACK_TYPE] = []
        # Price entity states while the history is replayed (the prices of then, not of now); None otherwise.
        self._replay_prices: dict[str, State] | None = None
        # The recorder's history has been read once (at the first start, or after an update adding it).
        self.history_imported = False
        self._reset_data(dt_util.utcnow())
        self._shown_month = self.month_totals()[0]

    def _reset_data(self, now: datetime) -> None:
        self.since = now
        self.total = Totals()
        self.months: dict[str, Totals] = {}
        self.trip: Trip | None = None  # open trip (driving)
        self._trip_start = Totals()  # totals when the open trip started
        self.trips: list[Trip] = []  # finished trips, newest first
        self.odometer: float | None = None
        self._levels = {FUEL: _Level(), ENERGY: _Level()}
        self._charger = _Charger()

    # ── Listeners ───────────────────────────────────────────────────────────

    def async_add_listener(self, update_callback: CALLBACK_TYPE) -> Callable[[], None]:
        self._listeners.append(update_callback)
        return lambda: self._listeners.remove(update_callback)

    def _notify_listeners(self) -> None:
        for update_callback in list(self._listeners):
            update_callback()

    # ── Configuration ───────────────────────────────────────────────────────

    @property
    def kind(self) -> str:
        if self.tracks_fuel and self.tracks_energy:
            return KIND_PLUGIN_HYBRID
        return KIND_ELECTRIC if self.tracks_energy else KIND_FUEL

    @property
    def currency(self) -> str:
        return self.hass.config.currency

    @property
    def fuel_price(self) -> float | None:
        """Current price per litre: the price entity's numeric state wins over the fixed price."""
        return self._price(self.fuel_price_entity, self.fixed_fuel_price, LITERS_PER_GALLON)

    @property
    def electricity_price(self) -> float | None:
        """Current price per kWh: the price entity's numeric state wins over the fixed price."""
        return self._price(self.electricity_price_entity, self.fixed_electricity_price, None)

    def _price(self, entity_id: str | None, fixed: float | None, per_gallon: float | None) -> float | None:
        if self._replay_prices is not None:
            state = self._replay_prices.get(entity_id) if entity_id else None
        else:
            state = self.hass.states.get(entity_id) if entity_id else None
        if state is not None:
            price = _float(state.state)
            if price is not None and price >= 0:
                unit = str(state.attributes.get(ATTR_UNIT_OF_MEASUREMENT) or "")
                # A price per US gallon becomes a price per litre; per MWh, per kWh.
                if per_gallon and unit.endswith("/gal"):
                    price /= per_gallon
                elif not per_gallon and unit.endswith("/MWh"):
                    price /= 1000
                return price
        return fixed

    # ── Readings ────────────────────────────────────────────────────────────

    def _reading(self, key: str, state: State | None = None) -> float | None:
        """Numeric state of a source sensor, in km / L / kWh / %; None when unknown or unavailable."""
        entity_id = self.sensors.get(key)
        if entity_id is None:
            return None
        if state is None:
            state = self.hass.states.get(entity_id)
        if state is None or state.state in (STATE_UNAVAILABLE, STATE_UNKNOWN):
            return None
        value = _float(state.state)
        if value is None:
            return None
        unit = state.attributes.get(ATTR_UNIT_OF_MEASUREMENT)
        # To km, L and kWh: Polestar's odometer can be in metres, Kia's energy left in kJ.
        factor = _UNIT_FACTORS.get(key, {}).get(unit, 1.0)
        return value * factor

    def _fuel_now(self, state: State | None = None, key: str | None = None) -> float | None:
        """Litres in the tank: the quantity sensor, else the level (%) times the tank capacity."""
        if CONF_FUEL_QUANTITY in self.sensors:
            return self._reading(CONF_FUEL_QUANTITY, state if key == CONF_FUEL_QUANTITY else None)
        level = self._reading(CONF_FUEL_LEVEL, state if key == CONF_FUEL_LEVEL else None)
        return level * self.tank_capacity / 100 if level is not None and self.tank_capacity else None

    def _energy_now(self, state: State | None = None, key: str | None = None) -> float | None:
        """kWh in the battery: the energy sensor, else the level (%) times the battery capacity."""
        if CONF_BATTERY_ENERGY in self.sensors:
            return self._reading(CONF_BATTERY_ENERGY, state if key == CONF_BATTERY_ENERGY else None)
        level = self._reading(CONF_BATTERY_LEVEL, state if key == CONF_BATTERY_LEVEL else None)
        return level * self.battery_capacity / 100 if level is not None and self.battery_capacity else None

    @property
    def fuel_quantity(self) -> float | None:
        return self._fuel_now()

    @property
    def fuel_level(self) -> float | None:
        if (level := self._reading(CONF_FUEL_LEVEL)) is not None:
            return level
        quantity = self._reading(CONF_FUEL_QUANTITY)
        return quantity / self.tank_capacity * 100 if quantity is not None and self.tank_capacity else None

    @property
    def battery_energy(self) -> float | None:
        return self._energy_now()

    @property
    def battery_level(self) -> float | None:
        if (level := self._reading(CONF_BATTERY_LEVEL)) is not None:
            return level
        energy = self._reading(CONF_BATTERY_ENERGY)
        return energy / self.battery_capacity * 100 if energy is not None and self.battery_capacity else None

    # ── Tracking ────────────────────────────────────────────────────────────

    def _month(self, now: datetime) -> Totals:
        key = dt_util.as_local(now).strftime("%Y-%m")
        if key not in self.months:
            self.months[key] = Totals()
            # Oldest months go first; keys sort chronologically.
            for old in sorted(self.months)[:-MAX_MONTHS]:
                del self.months[old]
        return self.months[key]

    def _process_odometer(self, value: float, now: datetime) -> bool:
        if self.odometer is None:
            self.odometer = value
            return True
        delta = value - self.odometer
        if abs(delta) > MAX_ODOMETER_JUMP:
            # Sensor reset, unit change or another car: start again from here without counting it.
            _LOGGER.debug("%s: odometer jump of %.0f km ignored", self.name, delta)
            self.odometer = value
            return True
        if delta <= 0:
            # Still, or a small step back (rounding, mile conversion): keep the highest reading.
            return False
        if self.trip is None:
            self._trip_start = self.total.copy()
            self.trip = Trip(start=now, end=None, totals=Totals())
        self.trip.end = now  # last move, while driving
        self.odometer = value
        self.total.distance += delta
        self._month(now).distance += delta
        return True

    def _process_level(self, kind: str, value: float, now: datetime) -> bool:
        level = self._levels[kind]
        rise_start = level.seen or now
        level.seen = now
        if level.ref is None:
            level.ref = value
            return True
        if value < level.ref:
            consumed = level.ref - value
            level.ref = value
            level.consumed_since_event = True
            month = self._month(now)
            price = self.fuel_price if kind == FUEL else self.electricity_price
            for totals in (self.total, month):
                setattr(totals, kind, getattr(totals, kind) + consumed)
                if price is not None:
                    totals.add_cost(consumed * price)
            return True
        threshold = self.refuel_threshold if kind == FUEL else self.charge_threshold
        if value - level.ref < threshold:
            return False  # noise: the reference stays
        amount = value - level.ref
        level.ref = value
        if kind == ENERGY and self._charger_moved_since(rise_start - CHARGER_OVERLAP):
            # Charged at home: the charger's session has it (losses included), not counted twice.
            level.consumed_since_event = True
            return True
        price = self.fuel_price if kind == FUEL else self.electricity_price
        last = next((e for e in level.events if e.source == SOURCE_AUTO), None)
        if (
            last is not None
            and not level.consumed_since_event
            and level.events[0] is last
            and now - last.time <= MERGE_WINDOW
        ):
            # The same refuel / charge reported in several steps.
            last.amount += amount
            last.time = now
            last.price = price
            last.cost = None if price is None else last.amount * price
        else:
            level.events.insert(
                0,
                Refill(
                    time=now,
                    amount=amount,
                    cost=None if price is None else amount * price,
                    price=price,
                    odometer=self.odometer,
                    source=SOURCE_AUTO,
                ),
            )
            del level.events[MAX_EVENTS:]
        level.consumed_since_event = False
        return True

    def _charger_moved_since(self, since: datetime) -> bool:
        moved = self._charger.last_move
        return CONF_CHARGER_ENERGY in self.sensors and moved is not None and moved >= since

    def _process_charger(self, value: float, now: datetime) -> bool:
        """A home charger counter reading: the counter going up is a home charge session."""
        charger = self._charger
        if charger.last is None:
            charger.last = value
            return True
        if value == charger.last:
            return False
        if value < charger.last:
            # A session counter back to 0: a new session, counted from 0.
            delta = value
            charger.session_start = None
        else:
            delta = value - charger.last
            self._close_charger_session(now)
        charger.last = value
        if delta <= 0 or delta > MAX_CHARGER_STEP:
            return True  # back to 0, or a glitch / replaced meter: the reading becomes the reference, nothing counted
        if charger.session_start is None:
            charger.session_start = now
            charger.session_amount = 0.0
        charger.session_amount += delta
        charger.last_move = now
        events = self._levels[ENERGY].events
        # Battery rises of this session already recorded (the car reported before the charger): the session has them.
        events[:] = [e for e in events if e.source != SOURCE_AUTO or e.time < charger.session_start - CHARGER_OVERLAP]
        amount = charger.session_amount
        if amount < self.charge_threshold:
            return True  # not a charge yet, as for a battery rise under the threshold
        price = self.electricity_price
        cost = None if price is None else amount * price
        session = next((e for e in events if e.source == SOURCE_CHARGER and e.start == charger.session_start), None)
        if session is None:
            events.append(Refill(now, amount, cost, price, self.odometer, SOURCE_CHARGER, charger.session_start))
        else:
            session.time, session.amount, session.cost, session.price = now, amount, cost, price
        events.sort(key=lambda e: e.time, reverse=True)
        del events[MAX_EVENTS:]
        return True

    def _close_charger_session(self, now: datetime) -> bool:
        """End the open home charge session once the counter has not moved for `CHARGER_SESSION_GAP`."""
        charger = self._charger
        if charger.session_start is None or (charger.last_move and now - charger.last_move < CHARGER_SESSION_GAP):
            return False
        charger.session_start = None
        charger.session_amount = 0.0
        return True

    def _process(self, key: str, state: State | None, now: datetime) -> bool:
        """Apply one sensor reading; True when something changed."""
        if key == CONF_CHARGER_ENERGY:
            value = self._reading(key, state)
            return value is not None and self._process_charger(value, now)
        if key == CONF_ODOMETER:
            value = self._reading(key, state)
            return value is not None and self._process_odometer(value, now)
        if key in (CONF_FUEL_QUANTITY, CONF_FUEL_LEVEL):
            value = self._fuel_now(state, key)
            return value is not None and self._process_level(FUEL, value, now)
        value = self._energy_now(state, key)
        return value is not None and self._process_level(ENERGY, value, now)

    def _end_trip_if_stopped(self, now: datetime) -> bool:
        """Close the open trip once the odometer has not moved for `trip_gap`."""
        if self.trip is None or self.trip.end is None or now - self.trip.end < self.trip_gap:
            return False
        trip = self.trip
        trip.totals = self.total.minus(self._trip_start)
        self.trip = None
        if trip.totals.distance > 0:
            self.trips.insert(0, trip)
            del self.trips[MAX_TRIPS:]
        return True

    def _changed(self) -> None:
        self._store.async_delay_save(self._dump, SAVE_DELAY)
        self._notify_listeners()

    @callback
    def async_listen(self) -> CALLBACK_TYPE:
        """Follow the source sensors and the price entities; close trips once the car has stopped."""
        by_entity: dict[str, list[str]] = {}
        for key, entity_id in self.sensors.items():
            by_entity.setdefault(entity_id, []).append(key)
        prices = {e for e in (self.fuel_price_entity, self.electricity_price_entity) if e}

        @callback
        def changed(event: Event[EventStateChangedData]) -> None:
            entity_id = event.data["entity_id"]
            now = dt_util.utcnow()
            updated = False
            for key in by_entity.get(entity_id, ()):
                updated |= self._process(key, event.data["new_state"], now)
            if updated:
                self._changed()
            elif entity_id in prices:
                self._notify_listeners()  # the current price is shown, nothing to store

        @callback
        def tick(now: datetime) -> None:
            month = self._shown_month
            self._shown_month = self.month_totals()[0]
            ended = self._end_trip_if_stopped(now)
            if self._close_charger_session(now) or ended:
                self._changed()
            elif month != self._shown_month:
                # A new month starts at zero even when the car stays parked.
                self._notify_listeners()

        unsubs = [
            async_track_state_change_event(self.hass, sorted(set(by_entity) | prices), changed),
            async_track_time_interval(self.hass, tick, timedelta(minutes=1)),
        ]

        @callback
        def unsubscribe() -> None:
            for unsub in unsubs:
                unsub()

        return unsubscribe

    # ── Manual events and reset ─────────────────────────────────────────────

    @callback
    def async_add_event(
        self,
        kind: str,
        amount: float,
        cost: float | None = None,
        price: float | None = None,
        odometer: float | None = None,
    ) -> None:
        """Log a refuel (kind `fuel`, litres) or a charge (`energy`, kWh) by hand.

        Shown in the lists only: the consumption keeps coming from the sensors. The total cost and the price
        complete each other; without either, the current price of the integration is used.
        """
        if cost is None and price is None:
            price = self.fuel_price if kind == FUEL else self.electricity_price
        if cost is None and price is not None:
            cost = amount * price
        elif price is None and cost is not None and amount > 0:
            price = cost / amount
        events = self._levels[kind].events
        events.append(
            Refill(
                time=dt_util.utcnow(),
                amount=amount,
                cost=cost,
                price=price,
                odometer=odometer if odometer is not None else self.odometer,
                source="manual",
            )
        )
        events.sort(key=lambda e: e.time, reverse=True)
        del events[MAX_EVENTS:]
        self._changed()

    @callback
    def async_reset(self) -> None:
        """Forget everything; the current readings become the new references."""
        now = dt_util.utcnow()
        self._reset_data(now)
        self._read_current(now)
        self._changed()

    def _read_current(self, now: datetime) -> bool:
        """Apply the current state of every source sensor (start-up: catches what changed while stopped)."""
        updated = False
        for key in self.sensors:
            updated |= self._process(key, None, now)
        return updated

    # ── History ─────────────────────────────────────────────────────────────

    async def async_import_history(self, days: float = DEFAULT_HISTORY_DAYS) -> bool:
        """Rebuild trips, months, refuels and charges from what the recorder kept of the source sensors.

        The last `days` are replayed in order, as if the integration had been there: the odometer makes the trips,
        the levels the consumption, refuels and charges, at the prices of then when a price sensor is used. The
        recorded states are kept 10 days by default; before them, the hourly long-term statistics of the sensors
        (kept for good, for sensors with a state class) stand in, one reading an hour. Manual refuels and charges
        are kept. False when the recorder is not there.
        """
        if "recorder" not in self.hass.config.components:
            return False
        from homeassistant.components.recorder import get_instance, history, statistics  # noqa: PLC0415

        recorder = get_instance(self.hass)
        prices = {e for e in (self.fuel_price_entity, self.electricity_price_entity) if e}
        entity_ids = sorted(set(self.sensors.values()) | prices)
        now = dt_util.utcnow()
        start = now - timedelta(days=days)
        states = await recorder.async_add_executor_job(
            partial(
                history.get_significant_states,
                self.hass,
                start,
                None,
                entity_ids,
                include_start_time_state=False,
                significant_changes_only=False,
                no_attributes=False,
            )
        )
        timeline = [(state.last_updated, entity_id, state) for entity_id, rows in states.items() for state in rows]
        # Where the recorded states of the source sensors begin: the statistics cover the time before.
        sources = set(self.sensors.values())
        first = min(
            (
                when
                for when, entity_id, state in timeline
                if entity_id in sources and state.state not in (STATE_UNAVAILABLE, STATE_UNKNOWN)
            ),
            default=now,
        )
        hourly: list[tuple[datetime, str, State]] = []
        if first - start > timedelta(hours=1):
            rows = await recorder.async_add_executor_job(
                statistics.statistics_during_period, self.hass, start, first, set(entity_ids), "hour", None, {"state"}
            )
            hourly = self._statistic_states(rows, states, first)
        # At the same time, the odometer first: the fuel or energy used in that step belongs to the trip it starts.
        odometer = self.sensors.get(CONF_ODOMETER)
        order = lambda row: (row[0], row[1] != odometer, row[1])  # noqa: E731
        hourly.sort(key=order)
        timeline.sort(key=order)
        self._replay([*hourly, *timeline], prices, dt_util.utcnow(), hourly_until=hourly[-1][0] if hourly else None)
        _LOGGER.debug("%s: %d hourly statistics and %d recorded states replayed", self.name, len(hourly), len(timeline))
        return True

    def _statistic_states(
        self, rows: dict[str, list[Any]], recorded: dict[str, list[State]], before: datetime
    ) -> list[tuple[datetime, str, State]]:
        """The hourly statistics as readings at the end of each hour, with the sensor's unit, before `before`.

        Only sensors with a sum (total or total-increasing state class, as an odometer or a tank) keep their state in
        the statistics.
        """
        out: list[tuple[datetime, str, State]] = []
        for entity_id, stats in rows.items():
            # The statistics are in the sensor's unit: take it from a recorded or the current state.
            sample = next(iter(recorded.get(entity_id) or ()), None) or self.hass.states.get(entity_id)
            attributes = dict(sample.attributes) if sample else {}
            for row in stats:
                begin, value = row.get("start"), row.get("state")
                if begin is None or value is None:
                    continue
                when = (
                    dt_util.utc_from_timestamp(begin) if isinstance(begin, int | float) else dt_util.as_utc(begin)
                ) + timedelta(hours=1)
                if when < before:
                    state = State(entity_id, str(value), attributes, last_changed=when, last_updated=when)
                    out.append((when, entity_id, state))
        return out

    @callback
    def _replay(
        self,
        timeline: Iterable[tuple[datetime, str, State]],
        prices: set[str],
        now: datetime,
        hourly_until: datetime | None = None,
    ) -> None:
        """Start over from the first recorded state and apply every one, then the current states.

        Up to `hourly_until` the readings are hourly statistics: a trip then only ends after an hour without the
        odometer moving (a trip over two hours is one trip, not two).
        """
        rows = list(timeline)
        by_entity: dict[str, list[str]] = {}
        for key, entity_id in self.sensors.items():
            by_entity.setdefault(entity_id, []).append(key)
        manual = {kind: [e for e in level.events if e.source == "manual"] for kind, level in self._levels.items()}
        self._reset_data(rows[0][0] if rows else now)
        self._replay_prices = {}
        trip_gap = self.trip_gap
        try:
            for when, entity_id, state in rows:
                hourly = hourly_until is not None and when <= hourly_until
                self.trip_gap = max(trip_gap, HOURLY_TRIP_GAP) if hourly else trip_gap
                # What the 1-minute tick would have done between two readings.
                self._end_trip_if_stopped(when)
                self._close_charger_session(when)
                if entity_id in prices:
                    self._replay_prices[entity_id] = state
                for key in by_entity.get(entity_id, ()):
                    self._process(key, state, when)
        finally:
            self._replay_prices = None
            self.trip_gap = trip_gap
        self._end_trip_if_stopped(now)
        self._close_charger_session(now)
        self._read_current(now)
        for kind, events in manual.items():
            level_events = self._levels[kind].events
            level_events.extend(events)
            level_events.sort(key=lambda e: e.time, reverse=True)
            del level_events[MAX_EVENTS:]
        self.history_imported = True
        self._changed()

    # ── Storage ─────────────────────────────────────────────────────────────

    async def async_load(self) -> None:
        stored = await self._store.async_load()
        now = dt_util.utcnow()
        if stored:
            try:
                self._load(stored)
            except (KeyError, TypeError, ValueError, AttributeError):
                _LOGGER.exception("Stored data of %s could not be read; starting again", self.name)
                self._reset_data(now)
        # A trip still open in the store ended while Home Assistant was stopped (once the gap has passed).
        updated = self._end_trip_if_stopped(now)
        updated |= self._close_charger_session(now)
        if self._read_current(now) or updated or not stored:
            self._store.async_delay_save(self._dump, SAVE_DELAY)

    def _load(self, data: dict[str, Any]) -> None:
        self.since = dt_util.parse_datetime(str(data.get("since"))) or dt_util.utcnow()
        self.total = Totals.load(data.get("total"))
        self.months = {str(k): Totals.load(v) for k, v in (data.get("months") or {}).items()}
        self.odometer = _float(data.get("odometer"))
        self.trips = [t for d in data.get("trips") or [] if (t := Trip.load(d))]
        self.trip = None
        if (open_trip := data.get("trip")) and (trip := Trip.load(open_trip)):
            self.trip = trip
            self._trip_start = Totals.load(open_trip.get("start_totals"))
        for kind in (FUEL, ENERGY):
            raw = data.get(kind) or {}
            self._levels[kind] = _Level(
                ref=_float(raw.get("ref")),
                events=[e for d in raw.get("events") or [] if (e := Refill.load(d))],
                consumed_since_event=bool(raw.get("consumed_since_event", True)),
                seen=_time(raw.get("seen")),
            )
        self._charger = _Charger.load(data.get("charger"))
        self.history_imported = bool(data.get("history_imported"))

    def _dump(self) -> dict[str, Any]:
        return {
            "since": self.since.isoformat(),
            "total": asdict(self.total),
            "months": {k: asdict(v) for k, v in self.months.items()},
            "odometer": self.odometer,
            "trip": {**self.trip.dump(), "start_totals": asdict(self._trip_start)} if self.trip else None,
            "trips": [t.dump() for t in self.trips],
            **{
                kind: {
                    "ref": level.ref,
                    "events": [e.dump() for e in level.events],
                    "consumed_since_event": level.consumed_since_event,
                    "seen": _iso(level.seen),
                }
                for kind, level in self._levels.items()
            },
            "charger": self._charger.dump(),
            "history_imported": self.history_imported,
        }

    async def async_save(self) -> None:
        """Write now (on unload: a reload must lose nothing)."""
        await self._store.async_save(self._dump())

    async def async_remove(self) -> None:
        await self._store.async_remove()

    # ── Figures ─────────────────────────────────────────────────────────────

    @property
    def driving(self) -> bool:
        return self.trip is not None

    def current_trip(self) -> dict[str, Any] | None:
        """The trip in progress (end None), else the last finished one."""
        if self.trip is not None:
            return Trip(self.trip.start, None, self.total.minus(self._trip_start)).summary()
        return self.trips[0].summary() if self.trips else None

    def month_totals(self) -> tuple[str, Totals]:
        key = dt_util.as_local(dt_util.utcnow()).strftime("%Y-%m")
        return key, self.months.get(key) or Totals()

    @staticmethod
    def month_start() -> datetime:
        """Start of the current month (local time): when the monthly totals went back to zero."""
        return dt_util.start_of_local_day().replace(day=1)

    def months_summary(self) -> list[dict[str, Any]]:
        """Every stored month, oldest first, with the current month even before anything happened in it."""
        key, current = self.month_totals()
        months = {**self.months, key: current}
        return [{"month": k, **months[k].summary()} for k in sorted(months)[-MAX_MONTHS:]]

    @property
    def refuels(self) -> list[Refill]:
        return self._levels[FUEL].events

    @property
    def charges(self) -> list[Refill]:
        return self._levels[ENERGY].events

    def average(self, kind: str) -> float | None:
        """All-time L/100 km (`fuel`) or kWh/100 km (`energy`)."""
        return self.total.summary()[f"{kind}_consumption"]

    def attributes(self) -> dict[str, Any]:
        """Everything the card shows (exact keys: the card relies on them)."""
        month_key, month = self.month_totals()
        return {
            "vehicle": self.name,
            "entry_id": self.entry_id,
            "kind": self.kind,
            "currency": self.currency,
            "odometer": _round(self.odometer, 1),
            "fuel_quantity": _round(self.fuel_quantity, 2),
            "fuel_level": _round(self.fuel_level, 1),
            "tank_capacity": self.tank_capacity,
            "battery_energy": _round(self.battery_energy, 2),
            "battery_level": _round(self.battery_level, 1),
            "battery_capacity": self.battery_capacity,
            "fuel_price": _round(self.fuel_price, 3),
            "electricity_price": _round(self.electricity_price, 3),
            "driving": self.driving,
            "trip": self.current_trip(),
            "month": {"month": month_key, **month.summary()},
            "total": {"since": self.since.isoformat(), **self.total.summary()},
            "months": self.months_summary(),
            "trips": [t.summary() for t in self.trips],
            "refuels": [e.summary("liters") for e in self.refuels],
            "charges": [e.summary("energy") for e in self.charges],
        }


def _positive(value: Any) -> float | None:
    number = _float(value)
    return number if number is not None and number > 0 else None

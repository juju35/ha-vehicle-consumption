"""Sensors: average consumption (with everything the card shows), trip / month / average figures, costs, refills."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorEntityDescription,
    SensorStateClass,
)
from homeassistant.const import UnitOfEnergy, UnitOfLength, UnitOfMass, UnitOfVolume
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from . import VehicleConsumptionConfigEntry
from .const import UNIT_ENERGY_CONSUMPTION, UNIT_FUEL_CONSUMPTION, UNIT_MI_PER_KWH, UNIT_MPG
from .entity import VehicleConsumptionEntity
from .tracker import ENERGY, FUEL, KM_PER_MILE, ConsumptionTracker, Refill


@dataclass(frozen=True, kw_only=True)
class VehicleSensorDescription(SensorEntityDescription):
    """A figure read from the tracker (metric, or imperial with `True`); `kind` limits it to vehicles tracking fuel or
    energy."""

    value_fn: Callable[[ConsumptionTracker, bool], Any]
    kind: str | None = None


# Units and statistics: a sensor's native unit never changes with the units option (a new unit for the same entity
# would break its long-term statistics). Distances and volumes stay in km and L, shown in mi and gal through Home
# Assistant's suggested unit (it converts them, statistics included). Consumptions, cost and CO₂ per distance, which it
# cannot convert (L/100 km is not mpg), stay metric and give the figure in the units chosen in `imperial_value` /
# `imperial_unit` attributes (what the card shows).
_IMPERIAL_DISPLAY = {SensorDeviceClass.DISTANCE: UnitOfLength.MILES, SensorDeviceClass.VOLUME: UnitOfVolume.GALLONS}
ATTR_IMPERIAL_VALUE = "imperial_value"
ATTR_IMPERIAL_UNIT = "imperial_unit"


def _trip(key: str) -> Callable[[ConsumptionTracker, bool], Any]:
    return lambda t, imperial: (t.current_trip(imperial) or {}).get(key)


def _month(key: str) -> Callable[[ConsumptionTracker, bool], Any]:
    return lambda t, imperial: t.month_totals()[1].summary(t.co2, imperial)[key]


def _consumption_unit(kind: str, imperial: bool) -> str:
    if kind == FUEL:
        return UNIT_MPG if imperial else UNIT_FUEL_CONSUMPTION
    return UNIT_MI_PER_KWH if imperial else UNIT_ENERGY_CONSUMPTION


SENSORS: tuple[VehicleSensorDescription, ...] = (
    VehicleSensorDescription(
        key="fuel_consumption_trip",
        kind=FUEL,
        native_unit_of_measurement=UNIT_FUEL_CONSUMPTION,
        suggested_display_precision=1,
        value_fn=_trip("fuel_consumption"),
    ),
    VehicleSensorDescription(
        key="fuel_consumption_month",
        kind=FUEL,
        native_unit_of_measurement=UNIT_FUEL_CONSUMPTION,
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=1,
        value_fn=_month("fuel_consumption"),
    ),
    VehicleSensorDescription(
        key="fuel_consumption_average",
        kind=FUEL,
        native_unit_of_measurement=UNIT_FUEL_CONSUMPTION,
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=1,
        value_fn=lambda t, imperial: t.average(FUEL, imperial),
    ),
    VehicleSensorDescription(
        key="energy_consumption_trip",
        kind=ENERGY,
        native_unit_of_measurement=UNIT_ENERGY_CONSUMPTION,
        suggested_display_precision=1,
        value_fn=_trip("energy_consumption"),
    ),
    VehicleSensorDescription(
        key="energy_consumption_month",
        kind=ENERGY,
        native_unit_of_measurement=UNIT_ENERGY_CONSUMPTION,
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=1,
        value_fn=_month("energy_consumption"),
    ),
    VehicleSensorDescription(
        key="energy_consumption_average",
        kind=ENERGY,
        native_unit_of_measurement=UNIT_ENERGY_CONSUMPTION,
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=1,
        value_fn=lambda t, imperial: t.average(ENERGY, imperial),
    ),
    VehicleSensorDescription(
        key="distance_trip",
        device_class=SensorDeviceClass.DISTANCE,
        native_unit_of_measurement=UnitOfLength.KILOMETERS,
        suggested_display_precision=1,
        value_fn=_trip("distance"),
    ),
    VehicleSensorDescription(
        key="distance_month",
        device_class=SensorDeviceClass.DISTANCE,
        native_unit_of_measurement=UnitOfLength.KILOMETERS,
        state_class=SensorStateClass.TOTAL,
        suggested_display_precision=1,
        value_fn=_month("distance"),
    ),
    VehicleSensorDescription(
        key="fuel_used_month",
        kind=FUEL,
        device_class=SensorDeviceClass.VOLUME,
        native_unit_of_measurement=UnitOfVolume.LITERS,
        state_class=SensorStateClass.TOTAL,
        suggested_display_precision=2,
        value_fn=_month("fuel"),
    ),
    VehicleSensorDescription(
        key="energy_used_month",
        kind=ENERGY,
        device_class=SensorDeviceClass.ENERGY,
        native_unit_of_measurement=UnitOfEnergy.KILO_WATT_HOUR,
        state_class=SensorStateClass.TOTAL,
        suggested_display_precision=2,
        value_fn=_month("energy"),
    ),
    VehicleSensorDescription(
        key="cost_month",
        device_class=SensorDeviceClass.MONETARY,
        state_class=SensorStateClass.TOTAL,
        suggested_display_precision=2,
        value_fn=_month("cost"),
    ),
    VehicleSensorDescription(
        key="cost_per_km",
        suggested_display_precision=3,
        value_fn=lambda t, imperial: t.total.summary(None, imperial)["cost_per_km"],
    ),
    VehicleSensorDescription(
        key="co2_trip",
        native_unit_of_measurement=UnitOfMass.KILOGRAMS,
        suggested_display_precision=1,
        value_fn=_trip("co2"),
    ),
    VehicleSensorDescription(
        key="co2_month",
        native_unit_of_measurement=UnitOfMass.KILOGRAMS,
        state_class=SensorStateClass.TOTAL,
        suggested_display_precision=1,
        value_fn=_month("co2"),
    ),
    VehicleSensorDescription(
        key="co2_per_km",
        native_unit_of_measurement="g/km",
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=0,
        value_fn=lambda t, imperial: t.total.summary(t.co2, imperial)["co2_per_km"],
    ),
)


# Distance left before the next service (negative once overdue): unknown until vehicle_consumption.log_service.
NEXT_SERVICE = VehicleSensorDescription(
    key="next_service",
    device_class=SensorDeviceClass.DISTANCE,
    native_unit_of_measurement=UnitOfLength.KILOMETERS,
    suggested_display_precision=0,
    value_fn=lambda t, imperial: t.service_remaining(),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: VehicleConsumptionConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    tracker = entry.runtime_data
    tracked = {FUEL: tracker.tracks_fuel, ENERGY: tracker.tracks_energy}
    entities: list[SensorEntity] = [ConsumptionSensor(tracker)]
    entities.extend(VehicleSensor(tracker, d) for d in SENSORS if d.kind is None or tracked[d.kind])
    entities.append(NextServiceSensor(tracker, NEXT_SERVICE))
    if tracker.tracks_fuel:
        entities.append(LastRefillSensor(tracker, FUEL))
    if tracker.tracks_energy:
        entities.append(LastRefillSensor(tracker, ENERGY))
    async_add_entities(entities)


class ConsumptionSensor(VehicleConsumptionEntity, SensorEntity):
    """Average consumption of the main energy (fuel if tracked, else electricity); the card data in the attributes."""

    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_suggested_display_precision = 1
    # Card data that changes with every reading, trip and refill: kept out of the recorder (a new row at each change,
    # and the lists could exceed its limit). The figures have sensors of their own.
    _unrecorded_attributes = frozenset(
        {
            "months",
            "trips",
            "refuels",
            "charges",
            "trip",
            "month",
            "total",
            "fuel_price",
            "electricity_price",
            "odometer",
            "fuel_quantity",
            "fuel_level",
            "battery_energy",
            "battery_level",
            "trip_count",
            "refuel_count",
            "charge_count",
        }
    )

    def __init__(self, tracker: ConsumptionTracker) -> None:
        super().__init__(tracker, "consumption")
        self._kind = FUEL if tracker.tracks_fuel else ENERGY
        self._attr_native_unit_of_measurement = _consumption_unit(self._kind, False)

    @property
    def native_value(self) -> float | None:
        return self.tracker.average(self._kind, False)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        attributes = self.tracker.attributes()
        if self.tracker.imperial:
            attributes[ATTR_IMPERIAL_VALUE] = self.tracker.average(self._kind, True)
            attributes[ATTR_IMPERIAL_UNIT] = _consumption_unit(self._kind, True)
        return attributes


class VehicleSensor(VehicleConsumptionEntity, SensorEntity):
    """One figure of a trip, the month or the whole period."""

    entity_description: VehicleSensorDescription

    def __init__(self, tracker: ConsumptionTracker, description: VehicleSensorDescription) -> None:
        super().__init__(tracker, description.key)
        self.entity_description = description
        # The unit of the figure in the units chosen when Home Assistant cannot convert to it (None: it can, or metric).
        self._imperial_unit: str | None = None
        if description.key == "cost_month":
            self._attr_native_unit_of_measurement = tracker.currency
        elif description.key == "cost_per_km":
            self._attr_native_unit_of_measurement = f"{tracker.currency}/km"
            self._imperial_unit = f"{tracker.currency}/mi"
        elif description.key == "co2_per_km":
            self._imperial_unit = "g/mi"
        elif description.kind is not None and description.key.startswith(f"{description.kind}_consumption"):
            self._imperial_unit = _consumption_unit(description.kind, True)
        if not tracker.imperial:
            self._imperial_unit = None
        elif description.device_class in _IMPERIAL_DISPLAY:
            self._attr_suggested_unit_of_measurement = _IMPERIAL_DISPLAY[description.device_class]

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        self._follow_units()

    def _follow_units(self) -> None:
        """A distance / volume registered before a change of the units option: shown in the new units.

        Home Assistant only reads the suggested unit when it registers the entity: the one it keeps (`sensor.private`)
        is updated here. A unit picked by the user in the entity settings still wins.
        """
        device_class = self.entity_description.device_class
        if device_class not in _IMPERIAL_DISPLAY or self.registry_entry is None:
            return
        native = self.entity_description.native_unit_of_measurement
        wanted = (
            _IMPERIAL_DISPLAY[device_class]
            if self.tracker.imperial
            else self.hass.config.units.get_converted_unit(device_class, native)
        )
        private = dict(self.registry_entry.options.get("sensor.private") or {})
        if private.get("suggested_unit_of_measurement") == wanted:
            return
        if wanted is None:
            private.pop("suggested_unit_of_measurement", None)
        else:
            private["suggested_unit_of_measurement"] = wanted
        er.async_get(self.hass).async_update_entity_options(self.entity_id, "sensor.private", private)

    @property
    def native_value(self) -> float | None:
        return self.entity_description.value_fn(self.tracker, False)

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        if self._imperial_unit is None:
            return None
        return {
            ATTR_IMPERIAL_VALUE: self.entity_description.value_fn(self.tracker, True),
            ATTR_IMPERIAL_UNIT: self._imperial_unit,
        }

    @property
    def last_reset(self) -> datetime | None:
        """Monthly totals start again at zero on the first of the month."""
        if self.entity_description.state_class is SensorStateClass.TOTAL:
            return self.tracker.month_start()
        return None


class LastRefillSensor(VehicleConsumptionEntity, SensorEntity):
    """Time of the last refuel (`last_refuel`) or charge (`last_charge`), with its amount and cost."""

    _attr_device_class = SensorDeviceClass.TIMESTAMP

    def __init__(self, tracker: ConsumptionTracker, kind: str) -> None:
        super().__init__(tracker, "last_refuel" if kind == FUEL else "last_charge")
        self._kind = kind

    @property
    def _last(self) -> Refill | None:
        events = self.tracker.refuels if self._kind == FUEL else self.tracker.charges
        return events[0] if events else None

    @property
    def native_value(self) -> datetime | None:
        return last.time if (last := self._last) else None

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        last = self._last
        summary = last.summary("liters" if self._kind == FUEL else "energy") if last else {}
        amount = "liters" if self._kind == FUEL else "energy"
        return {key: summary.get(key) for key in (amount, "cost", "odometer", "source")}


class NextServiceSensor(VehicleSensor):
    """Distance left before the next service, with the last service logged and the interval."""

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        service = self.tracker.service
        if not service:
            return None
        miles = KM_PER_MILE if self.tracker.imperial else 1.0
        return {
            "last_service": service.get("date"),
            "last_service_odometer": round(service["odometer"] / miles, 1),
            "interval": round(service["interval"] / miles, 1),
            "overdue": (self.tracker.service_remaining() or 0) < 0,
        }

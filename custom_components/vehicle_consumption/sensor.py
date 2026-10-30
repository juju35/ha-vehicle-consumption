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
from homeassistant.const import UnitOfEnergy, UnitOfLength, UnitOfVolume
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from . import VehicleConsumptionConfigEntry
from .const import UNIT_ENERGY_CONSUMPTION, UNIT_FUEL_CONSUMPTION
from .entity import VehicleConsumptionEntity
from .tracker import ENERGY, FUEL, ConsumptionTracker, Refill


@dataclass(frozen=True, kw_only=True)
class VehicleSensorDescription(SensorEntityDescription):
    """A figure read from the tracker; `kind` limits it to vehicles tracking fuel or energy."""

    value_fn: Callable[[ConsumptionTracker], Any]
    kind: str | None = None


def _trip(key: str) -> Callable[[ConsumptionTracker], Any]:
    return lambda t: (t.current_trip() or {}).get(key)


def _month(key: str) -> Callable[[ConsumptionTracker], Any]:
    return lambda t: t.month_totals()[1].summary()[key]


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
        value_fn=lambda t: t.average(FUEL),
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
        value_fn=lambda t: t.average(ENERGY),
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
        value_fn=lambda t: t.total.summary()["cost_per_km"],
    ),
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
    if tracker.tracks_fuel:
        entities.append(LastRefillSensor(tracker, FUEL))
    if tracker.tracks_energy:
        entities.append(LastRefillSensor(tracker, ENERGY))
    async_add_entities(entities)


class ConsumptionSensor(VehicleConsumptionEntity, SensorEntity):
    """Average consumption of the main energy (fuel if tracked, else electricity); the card data in the attributes."""

    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_suggested_display_precision = 1
    # Lists that change with every trip and refill: kept out of the recorder (they could exceed its limit).
    _unrecorded_attributes = frozenset({"months", "trips", "refuels", "charges"})

    def __init__(self, tracker: ConsumptionTracker) -> None:
        super().__init__(tracker, "consumption")
        self._kind = FUEL if tracker.tracks_fuel else ENERGY
        self._attr_native_unit_of_measurement = UNIT_FUEL_CONSUMPTION if self._kind == FUEL else UNIT_ENERGY_CONSUMPTION

    @property
    def native_value(self) -> float | None:
        return self.tracker.average(self._kind)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return self.tracker.attributes()


class VehicleSensor(VehicleConsumptionEntity, SensorEntity):
    """One figure of a trip, the month or the whole period."""

    entity_description: VehicleSensorDescription

    def __init__(self, tracker: ConsumptionTracker, description: VehicleSensorDescription) -> None:
        super().__init__(tracker, description.key)
        self.entity_description = description
        if description.key == "cost_month":
            self._attr_native_unit_of_measurement = tracker.currency
        elif description.key == "cost_per_km":
            self._attr_native_unit_of_measurement = f"{tracker.currency}/km"

    @property
    def native_value(self) -> float | None:
        return self.entity_description.value_fn(self.tracker)

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

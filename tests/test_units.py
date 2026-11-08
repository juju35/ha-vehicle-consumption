"""Tests for the units option (metric / imperial) and the attributes kept out of the recorder."""

from __future__ import annotations

from datetime import timedelta

from freezegun.api import FrozenDateTimeFactory
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import async_fire_time_changed

from custom_components.vehicle_consumption.const import (
    CONF_BATTERY_ENERGY,
    CONF_FUEL_PRICE,
    CONF_FUEL_QUANTITY,
    CONF_ODOMETER,
    CONF_UNITS,
    DOMAIN,
)
from custom_components.vehicle_consumption.sensor import ConsumptionSensor
from custom_components.vehicle_consumption.tracker import Totals

from .conftest import BATTERY, FUEL, KM, KWH, LITERS, ODOMETER, setup_vehicle, state_of

MI = {**KM, "unit_of_measurement": "mi"}
IMPERIAL = {CONF_ODOMETER: ODOMETER, CONF_FUEL_QUANTITY: FUEL, CONF_FUEL_PRICE: 2.0, CONF_UNITS: "imperial"}


def test_imperial_summary() -> None:
    """160.9344 km on 10 L: 100 mi, 2.64 gal, 37.9 mpg; cost and CO₂ per mile; energy in mi/kWh."""
    totals = Totals(distance=160.9344, fuel=10.0, energy=0.0, cost=20.0)
    out = totals.summary((2.31, 0.055), imperial=True)
    assert out["distance"] == 100.0
    assert out["fuel"] == 2.64
    assert out["fuel_consumption"] == 37.9
    assert out["energy_consumption"] is None  # no energy used: no mi/kWh
    assert out["cost_per_km"] == 0.2
    assert out["co2"] == 23.1 and out["co2_per_km"] == 231
    ev = Totals(distance=160.9344, energy=25.0).summary(None, imperial=True)
    assert ev["energy_consumption"] == 4.0 and ev["fuel_consumption"] is None
    # Metric unchanged.
    assert totals.summary()["fuel_consumption"] == 6.2 and totals.summary()["distance"] == 160.9


async def test_imperial_attributes_and_sensors(hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> None:
    await setup_vehicle(hass, IMPERIAL)
    hass.states.async_set(ODOMETER, "10160.9344", KM)
    hass.states.async_set(FUEL, "30", LITERS)
    await hass.async_block_till_done()
    freezer.tick(timedelta(minutes=70))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()

    state = state_of(hass, "consumption")
    attrs = state.attributes
    assert state.attributes["unit_of_measurement"] == "mpg" and float(state.state) == 37.9
    assert attrs["units"] == "imperial" and attrs["odometer_unit"] == "km"
    assert attrs["odometer"] == 6313.7
    assert attrs["fuel_quantity"] == 7.93
    assert attrs["fuel_price"] == 7.571  # per gallon
    assert attrs["trip"]["distance"] == 100.0 and attrs["trip"]["fuel_consumption"] == 37.9
    assert attrs["month"]["distance"] == 100.0 and attrs["total"]["cost_per_km"] == 0.2

    assert state_of(hass, "fuel_consumption_trip").attributes["unit_of_measurement"] == "mpg"
    assert state_of(hass, "cost_per_km").attributes["unit_of_measurement"] == "EUR/mi"
    assert state_of(hass, "co2_per_km").attributes["unit_of_measurement"] == "g/mi"
    # Distances and volumes stay in km and L: Home Assistant converts them itself.
    distance = state_of(hass, "distance_trip")
    assert distance.attributes["unit_of_measurement"] == "km" and float(distance.state) == 160.9


async def test_electric_imperial_unit(hass: HomeAssistant) -> None:
    await setup_vehicle(
        hass,
        {CONF_ODOMETER: ODOMETER, CONF_BATTERY_ENERGY: BATTERY, CONF_UNITS: "imperial"},
        states={ODOMETER: ("10000", KM), BATTERY: ("50", KWH)},
    )
    assert state_of(hass, "consumption").attributes["unit_of_measurement"] == "mi/kWh"
    assert state_of(hass, "energy_consumption_month").attributes["unit_of_measurement"] == "mi/kWh"


async def test_metric_by_default(hass: HomeAssistant) -> None:
    await setup_vehicle(hass)
    state = state_of(hass, "consumption")
    assert state.attributes["unit_of_measurement"] == "L/100 km" and state.attributes["units"] == "metric"
    assert state_of(hass, "cost_per_km").attributes["unit_of_measurement"] == "EUR/km"


async def test_manual_odometer_in_the_source_unit(hass: HomeAssistant) -> None:
    """An odometer typed in the add_refuel action is in the odometer sensor's unit (miles here), stored in km."""
    entry = await setup_vehicle(
        hass, {CONF_ODOMETER: ODOMETER, CONF_FUEL_QUANTITY: FUEL}, states={ODOMETER: ("6000", MI), FUEL: ("40", LITERS)}
    )
    await hass.services.async_call(
        DOMAIN, "add_refuel", {"config_entry_id": entry.entry_id, "liters": 30, "odometer": 6100}, blocking=True
    )
    [refuel] = state_of(hass, "consumption").attributes["refuels"]
    assert refuel["odometer"] == 9817.0  # 6100 mi


def test_card_attributes_not_recorded() -> None:
    """The card data that changes with every reading stays out of the recorder."""
    assert {
        "trip",
        "month",
        "total",
        "months",
        "trips",
        "refuels",
        "charges",
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
    } <= ConsumptionSensor._unrecorded_attributes

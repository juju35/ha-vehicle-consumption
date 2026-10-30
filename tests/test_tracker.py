"""Tests for the consumption tracking: levels, refuels, noise, trips, months, costs and units."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from freezegun.api import FrozenDateTimeFactory
from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import async_fire_time_changed

from custom_components.vehicle_consumption.const import (
    CONF_BATTERY_CAPACITY,
    CONF_BATTERY_ENERGY,
    CONF_BATTERY_LEVEL,
    CONF_ELECTRICITY_PRICE,
    CONF_ELECTRICITY_PRICE_ENTITY,
    CONF_FUEL_LEVEL,
    CONF_FUEL_PRICE,
    CONF_FUEL_PRICE_ENTITY,
    CONF_FUEL_QUANTITY,
    CONF_ODOMETER,
    CONF_TANK_CAPACITY,
    CONF_TRIP_GAP,
)

from .conftest import (
    BATTERY,
    BATTERY_LEVEL,
    ELECTRICITY_PRICE,
    FUEL,
    FUEL_LEVEL,
    FUEL_PRICE,
    KM,
    LITERS,
    ODOMETER,
    PERCENT,
    entity_id,
    setup_vehicle,
    state_of,
)


def _attrs(hass: HomeAssistant) -> dict[str, Any]:
    return dict(state_of(hass, "consumption").attributes)


async def _set(hass: HomeAssistant, entity_id: str, value: float | str, attributes: dict[str, Any]) -> None:
    hass.states.async_set(entity_id, str(value), attributes)
    await hass.async_block_till_done()


async def _drive(hass: HomeAssistant, odometer: float, fuel: float) -> None:
    await _set(hass, ODOMETER, odometer, KM)
    await _set(hass, FUEL, fuel, LITERS)


async def _stop(hass: HomeAssistant, freezer: FrozenDateTimeFactory, minutes: int = 31) -> None:
    freezer.tick(timedelta(minutes=minutes))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()


async def test_fuel_consumption(hass: HomeAssistant) -> None:
    await setup_vehicle(hass, {CONF_ODOMETER: ODOMETER, CONF_FUEL_QUANTITY: FUEL, CONF_FUEL_PRICE: 1.8})
    attrs = _attrs(hass)
    assert attrs["kind"] == "fuel" and attrs["vehicle"] == "My car" and attrs["entry_id"]
    assert attrs["odometer"] == 10000 and attrs["fuel_quantity"] == 40
    assert state_of(hass, "consumption").state == "unknown"  # no distance yet

    await _drive(hass, 10100, 34)
    state = state_of(hass, "consumption")
    assert state.state == "6.0"
    assert state.attributes["unit_of_measurement"] == "L/100 km"
    total = state.attributes["total"]
    assert total["distance"] == 100 and total["fuel"] == 6
    assert total["cost"] == 10.8 and total["cost_per_km"] == 0.108
    assert total["energy_consumption"] == 0
    assert state_of(hass, "fuel_used_month").state == "6.0"
    assert state_of(hass, "cost_month").attributes["unit_of_measurement"] == "EUR"
    assert state_of(hass, "cost_per_km").attributes["unit_of_measurement"] == "EUR/km"
    # A fuel car has no energy entities
    assert state_of(hass, "energy_consumption_average") is None
    assert state_of(hass, "last_charge") is None


async def test_short_distance_has_no_consumption(hass: HomeAssistant) -> None:
    await setup_vehicle(hass)
    await _drive(hass, 10003, 39.5)
    total = _attrs(hass)["total"]
    assert total["distance"] == 3 and total["fuel"] == 0.5
    assert total["fuel_consumption"] is None and total["cost_per_km"] is None
    assert total["cost"] is None  # no price at all


async def test_refuel_detection_and_noise(hass: HomeAssistant) -> None:
    await setup_vehicle(hass, {CONF_ODOMETER: ODOMETER, CONF_FUEL_QUANTITY: FUEL, CONF_FUEL_PRICE: 2.0})
    await _drive(hass, 10100, 34)

    # Noise: +1 L (slope, temperature) is ignored and the reference stays at 34
    await _set(hass, FUEL, 35, LITERS)
    assert _attrs(hass)["refuels"] == []
    await _set(hass, FUEL, 33, LITERS)
    assert _attrs(hass)["total"]["fuel"] == 7  # 6 + (34 - 33), not 6 + (35 - 33)

    # Refuel: +20 L
    await _set(hass, FUEL, 53, LITERS)
    [refuel] = _attrs(hass)["refuels"]
    assert refuel["liters"] == 20 and refuel["cost"] == 40 and refuel["price"] == 2
    assert refuel["odometer"] == 10100 and refuel["source"] == "auto"
    # A refuel reported in two steps is one refuel
    await _set(hass, FUEL, 60, LITERS)
    [refuel] = _attrs(hass)["refuels"]
    assert refuel["liters"] == 27
    # Consumption goes on from the new level; the refuel is not consumption
    await _drive(hass, 10200, 54)
    assert _attrs(hass)["total"]["fuel"] == 13
    state = state_of(hass, "last_refuel")
    assert state.attributes["liters"] == 27 and state.attributes["source"] == "auto"

    # After driving, a new rise is a new refuel
    await _set(hass, FUEL, 60, LITERS)
    assert len(_attrs(hass)["refuels"]) == 2


async def test_unknown_and_unavailable_ignored(hass: HomeAssistant) -> None:
    await setup_vehicle(hass)
    await _set(hass, FUEL, "unavailable", LITERS)
    await _set(hass, ODOMETER, "unknown", KM)
    await _set(hass, FUEL, "not a number", LITERS)
    # Coming back at the same level: nothing consumed, no refuel
    await _drive(hass, 10000, 40)
    attrs = _attrs(hass)
    assert attrs["total"]["fuel"] == 0 and attrs["refuels"] == [] and attrs["total"]["distance"] == 0
    assert state_of(hass, "consumption").state == "unknown"


async def test_odometer_jump_ignored(hass: HomeAssistant) -> None:
    await setup_vehicle(hass)
    await _set(hass, ODOMETER, 10050, KM)
    await _set(hass, ODOMETER, 50000, KM)  # replaced sensor / wrong reading
    await _set(hass, ODOMETER, 50010, KM)
    await _set(hass, ODOMETER, 50005, KM)  # step back: kept at the highest
    assert _attrs(hass)["total"]["distance"] == 60


async def test_trips(hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> None:
    await setup_vehicle(hass, {CONF_ODOMETER: ODOMETER, CONF_FUEL_QUANTITY: FUEL, CONF_TRIP_GAP: 30})
    assert _attrs(hass)["trip"] is None and not _attrs(hass)["driving"]

    await _drive(hass, 10020, 39)
    freezer.tick(timedelta(minutes=20))
    await _drive(hass, 10050, 37)
    attrs = _attrs(hass)
    assert attrs["driving"]
    assert attrs["trip"]["end"] is None and attrs["trip"]["distance"] == 50
    assert attrs["trip"]["fuel_consumption"] == 6.0
    assert attrs["trips"] == []

    await _stop(hass, freezer, 29)
    assert _attrs(hass)["driving"]  # within the gap
    await _stop(hass, freezer, 2)
    attrs = _attrs(hass)
    assert not attrs["driving"]
    [trip] = attrs["trips"]
    assert trip == attrs["trip"]
    assert trip["distance"] == 50 and trip["fuel"] == 3 and trip["fuel_consumption"] == 6
    assert trip["end"] is not None and trip["start"] < trip["end"]
    assert state_of(hass, "distance_trip").state == "50.0"
    assert state_of(hass, "fuel_consumption_trip").state == "6.0"

    # Second trip: newest first
    await _drive(hass, 10150, 31)
    await _stop(hass, freezer)
    trips = _attrs(hass)["trips"]
    assert [t["distance"] for t in trips] == [100, 50]
    assert trips[0]["fuel_consumption"] == 6


async def test_months(hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> None:
    tz = dt_util.get_default_time_zone()
    freezer.move_to(dt_util.as_utc(dt_util.parse_datetime("2026-09-30 12:00:00").replace(tzinfo=tz)))
    await setup_vehicle(hass, {CONF_ODOMETER: ODOMETER, CONF_FUEL_QUANTITY: FUEL, CONF_FUEL_PRICE: 2.0})
    await _drive(hass, 10100, 34)

    freezer.move_to(dt_util.as_utc(dt_util.parse_datetime("2026-10-02 12:00:00").replace(tzinfo=tz)))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    attrs = _attrs(hass)
    assert attrs["month"]["month"] == "2026-10" and attrs["month"]["distance"] == 0
    month_start = dt_util.as_utc(dt_util.parse_datetime("2026-10-01 00:00:00").replace(tzinfo=tz))
    assert dt_util.parse_datetime(state_of(hass, "cost_month").attributes["last_reset"]) == month_start
    assert state_of(hass, "distance_month").state == "0.0"

    await _drive(hass, 10300, 22)
    months = _attrs(hass)["months"]
    assert [m["month"] for m in months] == ["2026-09", "2026-10"]
    assert months[0]["distance"] == 100 and months[0]["fuel_consumption"] == 6 and months[0]["cost"] == 12
    assert months[1]["distance"] == 200 and months[1]["fuel"] == 12 and months[1]["cost"] == 24
    assert _attrs(hass)["total"]["distance"] == 300
    assert state_of(hass, "fuel_consumption_month").state == "6.0"


async def test_months_kept(hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> None:
    """24 months are kept, oldest first."""
    tz = dt_util.get_default_time_zone()
    freezer.move_to(dt_util.as_utc(dt_util.parse_datetime("2024-01-15 12:00:00").replace(tzinfo=tz)))
    await setup_vehicle(hass)
    odometer = 10000
    for month in range(26):
        year, index = divmod(month, 12)
        freezer.move_to(
            dt_util.as_utc(dt_util.parse_datetime(f"{2024 + year}-{index + 1:02d}-15 12:00:00").replace(tzinfo=tz))
        )
        odometer += 10
        await _set(hass, ODOMETER, odometer, KM)
    months = _attrs(hass)["months"]
    assert len(months) == 24
    assert months[0]["month"] == "2024-03" and months[-1]["month"] == "2026-02"


async def test_price_entity_wins_over_fixed(hass: HomeAssistant) -> None:
    states = {ODOMETER: ("10000", KM), FUEL: ("40", LITERS), FUEL_PRICE: ("1.5", {"unit_of_measurement": "EUR/L"})}
    options = {
        CONF_ODOMETER: ODOMETER,
        CONF_FUEL_QUANTITY: FUEL,
        CONF_FUEL_PRICE_ENTITY: FUEL_PRICE,
        CONF_FUEL_PRICE: 2.0,
    }
    await setup_vehicle(hass, options, states=states)
    assert _attrs(hass)["fuel_price"] == 1.5
    await _drive(hass, 10100, 34)
    assert _attrs(hass)["total"]["cost"] == 9.0

    # Price changes: what is consumed from now on costs the new price
    await _set(hass, FUEL_PRICE, "1.9", {"unit_of_measurement": "EUR/L"})
    assert _attrs(hass)["fuel_price"] == 1.9
    await _drive(hass, 10200, 28)
    assert _attrs(hass)["total"]["cost"] == 9.0 + 6 * 1.9

    # Price sensor unavailable: back to the fixed price
    await _set(hass, FUEL_PRICE, "unavailable", {})
    assert _attrs(hass)["fuel_price"] == 2.0
    await _drive(hass, 10300, 22)
    assert _attrs(hass)["total"]["cost"] == round(9.0 + 6 * 1.9 + 12, 2)


async def test_price_per_gallon(hass: HomeAssistant) -> None:
    states = {
        ODOMETER: ("10000", KM),
        FUEL: ("40", LITERS),
        FUEL_PRICE: ("3.785411784", {"unit_of_measurement": "$/gal"}),
    }
    options = {CONF_ODOMETER: ODOMETER, CONF_FUEL_QUANTITY: FUEL, CONF_FUEL_PRICE_ENTITY: FUEL_PRICE}
    await setup_vehicle(hass, options, states=states)
    assert _attrs(hass)["fuel_price"] == 1.0


async def test_fuel_level_with_capacity(hass: HomeAssistant) -> None:
    states = {ODOMETER: ("10000", KM), FUEL_LEVEL: ("50", PERCENT)}
    options = {CONF_ODOMETER: ODOMETER, CONF_FUEL_LEVEL: FUEL_LEVEL, CONF_TANK_CAPACITY: 50.0}
    await setup_vehicle(hass, options, states=states)
    attrs = _attrs(hass)
    assert attrs["fuel_level"] == 50 and attrs["fuel_quantity"] == 25 and attrs["tank_capacity"] == 50

    await _set(hass, ODOMETER, 10100, KM)
    await _set(hass, FUEL_LEVEL, 38, PERCENT)  # 6 L
    assert state_of(hass, "consumption").state == "6.0"


async def test_electric_vehicle_charge(hass: HomeAssistant) -> None:
    states = {
        ODOMETER: ("10000", KM),
        BATTERY_LEVEL: ("80", PERCENT),
        ELECTRICITY_PRICE: ("0.25", {"unit_of_measurement": "EUR/kWh"}),
    }
    options = {
        CONF_ODOMETER: ODOMETER,
        CONF_BATTERY_LEVEL: BATTERY_LEVEL,
        CONF_BATTERY_CAPACITY: 50.0,
        CONF_ELECTRICITY_PRICE_ENTITY: ELECTRICITY_PRICE,
        CONF_ELECTRICITY_PRICE: 0.4,
    }
    await setup_vehicle(hass, options, states=states)
    attrs = _attrs(hass)
    assert attrs["kind"] == "electric" and attrs["battery_energy"] == 40 and attrs["battery_level"] == 80
    assert state_of(hass, "fuel_consumption_average") is None

    await _set(hass, ODOMETER, 10100, KM)
    await _set(hass, BATTERY_LEVEL, 50, PERCENT)  # 15 kWh
    state = state_of(hass, "consumption")
    assert state.state == "15.0" and state.attributes["unit_of_measurement"] == "kWh/100 km"
    assert state.attributes["total"]["cost"] == 3.75
    assert state_of(hass, "energy_used_month").state == "15.0"

    # Battery noise: +1 % = 0.5 kWh < 1 kWh threshold
    await _set(hass, BATTERY_LEVEL, 51, PERCENT)
    assert _attrs(hass)["charges"] == []
    # Charge reported every few minutes: one charge
    for level in (60, 70, 90):
        await _set(hass, BATTERY_LEVEL, level, PERCENT)
    [charge] = _attrs(hass)["charges"]
    assert charge["energy"] == 20 and charge["cost"] == 5 and charge["source"] == "auto"
    assert state_of(hass, "last_charge").attributes["energy"] == 20


async def test_plugin_hybrid_and_units(hass: HomeAssistant) -> None:
    """Miles, US gallons and Wh are converted to km, litres and kWh."""
    states = {
        ODOMETER: ("1000", {**KM, "unit_of_measurement": "mi"}),
        FUEL: ("10", {"unit_of_measurement": "gal", "device_class": "volume_storage"}),
        BATTERY: ("10000", {"unit_of_measurement": "Wh", "device_class": "energy_storage"}),
    }
    options = {CONF_ODOMETER: ODOMETER, CONF_FUEL_QUANTITY: FUEL, CONF_BATTERY_ENERGY: BATTERY}
    await setup_vehicle(hass, options, states=states)
    attrs = _attrs(hass)
    assert attrs["kind"] == "plugin_hybrid"
    assert attrs["odometer"] == 1609.3 and attrs["fuel_quantity"] == 37.85 and attrs["battery_energy"] == 10

    await _set(hass, ODOMETER, 1100, {**KM, "unit_of_measurement": "mi"})  # 160.9 km
    await _set(hass, FUEL, 9, {"unit_of_measurement": "gal", "device_class": "volume_storage"})
    await _set(hass, BATTERY, 2000, {"unit_of_measurement": "Wh", "device_class": "energy_storage"})
    total = _attrs(hass)["total"]
    assert total["distance"] == 160.9
    assert total["fuel"] == 3.79 and total["fuel_consumption"] == 2.4
    assert total["energy"] == 8 and total["energy_consumption"] == 5.0
    # The main sensor shows fuel when fuel is tracked; both kinds have their entities
    assert state_of(hass, "consumption").attributes["unit_of_measurement"] == "L/100 km"
    assert state_of(hass, "energy_consumption_average").state == "5.0"
    assert state_of(hass, "fuel_consumption_average").state == "2.4"


async def test_metres_and_kilojoules(hass: HomeAssistant) -> None:
    """An odometer in metres (Polestar) and energy left in kJ (Kia / Hyundai) become km and kWh."""
    metres = {**KM, "unit_of_measurement": "m"}
    kilojoules = {"unit_of_measurement": "kJ", "device_class": "energy_storage"}
    states = {ODOMETER: ("10000000", metres), BATTERY: ("180000", kilojoules)}  # 10 000 km, 50 kWh
    await setup_vehicle(hass, {CONF_ODOMETER: ODOMETER, CONF_BATTERY_ENERGY: BATTERY}, states=states)
    assert _attrs(hass)["odometer"] == 10000 and _attrs(hass)["battery_energy"] == 50

    await _set(hass, ODOMETER, 10100000, metres)  # 100 km
    await _set(hass, BATTERY, 122400, kilojoules)  # 34 kWh: 16 kWh used
    total = _attrs(hass)["total"]
    assert total["distance"] == 100 and total["energy"] == 16 and total["energy_consumption"] == 16.0


async def test_restart_safe(hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> None:
    """Everything survives a reload, and what changed while unloaded is caught up."""
    entry = await setup_vehicle(hass, {CONF_ODOMETER: ODOMETER, CONF_FUEL_QUANTITY: FUEL, CONF_FUEL_PRICE: 2.0})
    await _drive(hass, 10100, 34)
    await _stop(hass, freezer)
    await _set(hass, FUEL, 54, LITERS)
    await _drive(hass, 10120, 53)  # a trip in progress
    before = _attrs(hass)

    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    # While unloaded: drove on
    hass.states.async_set(ODOMETER, "10140", KM)
    hass.states.async_set(FUEL, "52", LITERS)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    after = _attrs(hass)
    assert after["refuels"] == before["refuels"] and after["trips"] == before["trips"]
    assert after["total"]["distance"] == 140 and after["total"]["fuel"] == 8
    assert after["driving"] and after["trip"]["distance"] == 40
    assert after["total"]["since"] == before["total"]["since"]


async def test_open_trip_closed_after_restart(hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> None:
    entry = await setup_vehicle(hass)
    await _drive(hass, 10050, 37)
    assert _attrs(hass)["driving"]
    assert await hass.config_entries.async_unload(entry.entry_id)
    freezer.tick(timedelta(hours=2))
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    attrs = _attrs(hass)
    assert not attrs["driving"] and attrs["trips"][0]["distance"] == 50


async def test_corrupt_storage(hass: HomeAssistant, hass_storage: dict) -> None:
    hass_storage["vehicle_consumption.broken"] = {"version": 1, "data": {"months": "nonsense", "total": 3}}
    from pytest_homeassistant_custom_component.common import MockConfigEntry

    from custom_components.vehicle_consumption.const import DOMAIN

    hass.states.async_set(ODOMETER, "10000", KM)
    hass.states.async_set(FUEL, "40", LITERS)
    entry = MockConfigEntry(
        domain=DOMAIN,
        entry_id="broken",
        title="My car",
        data={"device_id": "x", "name": "My car"},
        options={CONF_ODOMETER: ODOMETER, CONF_FUEL_QUANTITY: FUEL},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert _attrs(hass)["total"]["distance"] == 0


async def test_main_lists_not_recorded(recorder_mock, hass: HomeAssistant) -> None:
    from homeassistant.components.recorder.history import get_significant_states
    from pytest_homeassistant_custom_component.components.recorder.common import async_wait_recording_done

    start = dt_util.utcnow()
    await setup_vehicle(hass)
    await _drive(hass, 10100, 34)
    await async_wait_recording_done(hass)
    main = entity_id(hass, "consumption")
    states = await recorder_mock.async_add_executor_job(get_significant_states, hass, start, None, [main])
    recorded = states[main][-1].attributes
    assert not {"months", "trips", "refuels", "charges"} & set(recorded)
    assert recorded["kind"] == "fuel"


async def test_month_rolls_over_while_parked(hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> None:
    """The month sensors go back to zero on the first of the month without any sensor change."""
    tz = dt_util.get_default_time_zone()
    freezer.move_to(dt_util.as_utc(dt_util.parse_datetime("2026-09-30 12:00:00").replace(tzinfo=tz)))
    await setup_vehicle(hass)
    await _drive(hass, 10100, 34)
    await _stop(hass, freezer)
    assert state_of(hass, "distance_month").state == "100.0"

    freezer.move_to(dt_util.as_utc(dt_util.parse_datetime("2026-10-01 00:01:00").replace(tzinfo=tz)))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert state_of(hass, "distance_month").state == "0.0"
    assert state_of(hass, "fuel_used_month").state == "0.0"
    assert _attrs(hass)["month"]["month"] == "2026-10"

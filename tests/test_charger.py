"""Tests for the home charger: detection, config flow, sessions from its energy counter, no double counting."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

import pytest
from freezegun.api import FrozenDateTimeFactory
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from pytest_homeassistant_custom_component.common import async_fire_time_changed

from custom_components.vehicle_consumption.charger import async_detect_charger
from custom_components.vehicle_consumption.const import (
    CONF_BATTERY_ENERGY,
    CONF_CHARGE_THRESHOLD,
    CONF_CHARGER_ENERGY,
    CONF_DEVICE_ID,
    CONF_ELECTRICITY_PRICE,
    CONF_FUEL_QUANTITY,
    CONF_ODOMETER,
    CONF_REFUEL_THRESHOLD,
    CONF_TRIP_GAP,
    DOMAIN,
)

from .conftest import BATTERY, KM, KWH, ODOMETER, add_sensor, setup_vehicle, state_of, vehicle_device

CHARGER = "sensor.wallbox_energy"
ENERGY = {"unit_of_measurement": "kWh", "device_class": "energy", "state_class": "total_increasing"}


def _charger_sensor(
    hass: HomeAssistant, platform: str, object_id: str, unique_id: str, translation_key: str | None
) -> str:
    device = vehicle_device(hass, f"{platform} charger", platform=platform)
    return add_sensor(
        hass, device, object_id, "10", ENERGY, platform=platform, unique_id=unique_id, translation_key=translation_key
    )


@pytest.mark.parametrize(
    ("platform", "object_id", "unique_id", "translation_key"),
    [
        ("evcc_intg", "evcc_garage_charge_total_import", "evcc_intg.evcc_1_charge_total_import", "chargetotalimport"),
        ("evcc_intg", "evcc_garage_session_energy", "evcc_intg.evcc_1_session_energy", "sessionenergy"),
        ("easee", "easee_lifetime_energy", "EH123456_lifetime_energy", "lifetime_energy"),
        ("easee", "easee_session_energy", "EH123456_session_energy", "session_energy"),
        ("zaptec", "zaptec_energy_meter", "abc-123_signed_meter_value_kwh", "signed_meter_value"),
        ("zaptec", "zaptec_session_total", "abc-123_total_charge_power_session", "total_charge_power_session"),
        ("wallbox", "wallbox_added_energy", "added_energy-12345", "added_energy"),
        ("ohme", "ohme_energy", "OHME1_energy", None),
    ],
)
async def test_detect_each_charger(
    hass: HomeAssistant, platform: str, object_id: str, unique_id: str, translation_key: str | None
) -> None:
    entity = _charger_sensor(hass, platform, object_id, unique_id, translation_key)
    assert async_detect_charger(hass) == entity


async def test_detect_matches_unique_id_without_translation_key(hass: HomeAssistant) -> None:
    entity = _charger_sensor(hass, "easee", "easee_lifetime", "EH1_lifetime_energy", None)
    assert async_detect_charger(hass) == entity


async def test_detect_prefers_total_counters(hass: HomeAssistant) -> None:
    _charger_sensor(hass, "evcc_intg", "a_session", "evcc_intg.evcc_1_session_energy", "sessionenergy")
    _charger_sensor(hass, "wallbox", "a_wallbox", "added_energy-1", "added_energy")
    total = _charger_sensor(hass, "easee", "z_lifetime", "EH1_lifetime_energy", "lifetime_energy")
    assert async_detect_charger(hass) == total


async def test_detect_nothing(hass: HomeAssistant) -> None:
    # Another platform's energy sensor, and a known one that is disabled
    _charger_sensor(hass, "shelly", "shelly_energy", "shelly_1_energy", "energy")
    device = vehicle_device(hass, "Easee", platform="easee")
    add_sensor(
        hass, device, "easee_lifetime", "1", ENERGY, platform="easee", unique_id="X_lifetime_energy",
        translation_key="lifetime_energy", disabled=True,
    )  # fmt: skip
    assert async_detect_charger(hass) is None


def _suggested(result: dict[str, Any]) -> dict[str, Any]:
    return {str(k): k.description["suggested_value"] for k in result["data_schema"].schema if k.description}


async def test_flow_prefills_charger_for_a_battery(hass: HomeAssistant) -> None:
    charger = _charger_sensor(hass, "easee", "easee_lifetime_energy", "EH1_lifetime_energy", "lifetime_energy")
    device = vehicle_device(hass, "Zoe")
    add_sensor(hass, device, "zoe_mileage", "1000", KM, unique_id="vf3_mileage", translation_key="mileage")
    add_sensor(
        hass, device, "zoe_energy", "30", KWH, unique_id="vf3_battery_available_energy",
        translation_key="battery_available_energy",
    )  # fmt: skip
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": "user"})
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {CONF_DEVICE_ID: device})
    assert result["description_placeholders"]["found"] == "2"  # the vehicle's sensors only
    assert _suggested(result)[CONF_CHARGER_ENERGY] == charger

    result = await hass.config_entries.flow.async_configure(
        result["flow_id"],
        {CONF_ODOMETER: "sensor.zoe_mileage", CONF_BATTERY_ENERGY: "sensor.zoe_energy", CONF_CHARGER_ENERGY: charger},
    )
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["options"][CONF_CHARGER_ENERGY] == charger


async def test_flow_no_charger_for_a_fuel_car(hass: HomeAssistant) -> None:
    charger = _charger_sensor(hass, "easee", "easee_lifetime_energy", "EH1_lifetime_energy", "lifetime_energy")
    device = vehicle_device(hass, "Clio")
    add_sensor(hass, device, "clio_mileage", "1000", KM, unique_id="vf2_mileage", translation_key="mileage")
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": "user"})
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {CONF_DEVICE_ID: device})
    assert CONF_CHARGER_ENERGY not in _suggested(result)

    result = await hass.config_entries.flow.async_configure(
        result["flow_id"],
        {CONF_ODOMETER: "sensor.clio_mileage", CONF_FUEL_QUANTITY: "sensor.q", CONF_CHARGER_ENERGY: charger},
    )
    assert result["errors"] == {CONF_CHARGER_ENERGY: "charger_needs_battery"}


async def test_options_flow_charger(hass: HomeAssistant) -> None:
    entry = await setup_vehicle(hass)  # fuel car
    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {CONF_ODOMETER: ODOMETER, CONF_FUEL_QUANTITY: "sensor.q", CONF_CHARGER_ENERGY: CHARGER}
    )
    assert result["errors"] == {CONF_CHARGER_ENERGY: "charger_needs_battery"}
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {CONF_ODOMETER: ODOMETER, CONF_BATTERY_ENERGY: BATTERY, CONF_CHARGER_ENERGY: CHARGER}
    )
    assert result["step_id"] == "prices"
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {CONF_TRIP_GAP: 30, CONF_REFUEL_THRESHOLD: 3, CONF_CHARGE_THRESHOLD: 1}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert entry.options[CONF_CHARGER_ENERGY] == CHARGER


# ── Tracking ────────────────────────────────────────────────────────────────


async def _ev(hass: HomeAssistant, charger: str = "1000", charger_attrs: dict[str, Any] | None = None):
    return await setup_vehicle(
        hass,
        {
            CONF_ODOMETER: ODOMETER,
            CONF_BATTERY_ENERGY: BATTERY,
            CONF_CHARGER_ENERGY: CHARGER,
            CONF_ELECTRICITY_PRICE: 0.2,
        },
        states={ODOMETER: ("20000", KM), BATTERY: ("30", KWH), CHARGER: (charger, charger_attrs or ENERGY)},
    )


async def _set(hass: HomeAssistant, entity_id: str, value: float, attributes: dict[str, Any]) -> None:
    hass.states.async_set(entity_id, str(value), attributes)
    await hass.async_block_till_done()


async def _wait(hass: HomeAssistant, freezer: FrozenDateTimeFactory, minutes: int) -> None:
    freezer.tick(timedelta(minutes=minutes))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()


def _charges(hass: HomeAssistant) -> list[dict[str, Any]]:
    return state_of(hass, "consumption").attributes["charges"]


async def test_total_counter_session(hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> None:
    """One home charge: the counter delta (losses included), not the battery rise; no double counting."""
    await _ev(hass)
    await _set(hass, CHARGER, 1005, ENERGY)
    await _wait(hass, freezer, 10)
    await _set(hass, BATTERY, 34, KWH)  # the car reports its rise: the charger's session has it
    await _wait(hass, freezer, 10)
    await _set(hass, CHARGER, 1011, ENERGY)
    await _wait(hass, freezer, 5)
    await _set(hass, BATTERY, 39.5, KWH)
    [charge] = _charges(hass)
    assert charge["energy"] == 11 and charge["cost"] == 2.2 and charge["price"] == 0.2
    assert charge["source"] == "charger" and charge["odometer"] == 20000
    last = state_of(hass, "last_charge")
    assert last.attributes["source"] == "charger" and last.attributes["energy"] == 11

    # 30 min without the counter moving ends the session: the next rise is another charge
    await _wait(hass, freezer, 40)
    await _set(hass, CHARGER, 1014, ENERGY)
    charges = _charges(hass)
    assert [c["energy"] for c in charges] == [3, 11]
    # Consumption still comes from the battery drops; charges do not count as consumption
    assert state_of(hass, "consumption").attributes["total"]["energy"] == 0


async def test_car_reports_before_the_charger(hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> None:
    """A battery rise recorded just before the counter moves becomes part of the charger's session."""
    await _ev(hass)
    await _set(hass, BATTERY, 35, KWH)
    assert _charges(hass)[0]["source"] == "auto"
    await _wait(hass, freezer, 5)
    await _set(hass, CHARGER, 1006, ENERGY)
    [charge] = _charges(hass)
    assert charge["source"] == "charger" and charge["energy"] == 6


async def test_session_counter_reset(hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> None:
    """A session counter going back to 0 starts a new session counted from 0."""
    await _ev(hass, "12.5")
    await _set(hass, CHARGER, 0, ENERGY)
    await _set(hass, CHARGER, 4, ENERGY)
    await _wait(hass, freezer, 10)
    await _set(hass, CHARGER, 9, ENERGY)
    assert [c["energy"] for c in _charges(hass)] == [9]
    # A new session read straight above 0 (its 0 was missed), right after the last one
    await _wait(hass, freezer, 5)
    await _set(hass, CHARGER, 2, ENERGY)
    assert [c["energy"] for c in _charges(hass)] == [2, 9]


async def test_counter_in_wh_and_glitches(hass: HomeAssistant) -> None:
    wh = {**ENERGY, "unit_of_measurement": "Wh"}
    await _ev(hass, "1000000", wh)
    await _set(hass, CHARGER, 1004500, wh)
    assert _charges(hass)[0]["energy"] == 4.5
    # unavailable is skipped; a jump of a replaced meter is not a charge
    hass.states.async_set(CHARGER, "unavailable", wh)
    await _set(hass, CHARGER, 900000000, wh)
    assert [c["energy"] for c in _charges(hass)] == [4.5]


async def test_small_session_is_not_a_charge(hass: HomeAssistant) -> None:
    await _ev(hass)
    await _set(hass, CHARGER, 1000.4, ENERGY)
    assert _charges(hass) == []
    await _set(hass, CHARGER, 1001.5, ENERGY)
    assert _charges(hass)[0]["energy"] == 1.5


async def test_away_charge_still_recorded(hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> None:
    await _ev(hass)
    await _set(hass, CHARGER, 1010, ENERGY)  # a home charge
    await _wait(hass, freezer, 120)
    await _set(hass, ODOMETER, 20100, KM)
    await _set(hass, BATTERY, 15, KWH)  # drove away: 15 kWh used
    await _wait(hass, freezer, 60)
    await _set(hass, BATTERY, 45, KWH)  # fast charger on the road, the home counter idle
    charges = _charges(hass)
    assert [(c["source"], c["energy"]) for c in charges] == [("auto", 30), ("charger", 10)]
    assert charges[0]["odometer"] == 20100
    assert state_of(hass, "consumption").attributes["total"]["energy"] == 15


async def test_charger_needs_a_battery(hass: HomeAssistant) -> None:
    """A counter left on a car without a battery is ignored."""
    await setup_vehicle(
        hass,
        {CONF_ODOMETER: ODOMETER, CONF_FUEL_QUANTITY: "sensor.car_fuel_quantity", CONF_CHARGER_ENERGY: CHARGER},
    )
    await _set(hass, CHARGER, 5, ENERGY)
    await _set(hass, CHARGER, 50, ENERGY)
    assert state_of(hass, "consumption").attributes["charges"] == []


async def test_restart_keeps_the_session(
    hass: HomeAssistant, freezer: FrozenDateTimeFactory, hass_storage: dict
) -> None:
    entry = await _ev(hass)
    await _set(hass, CHARGER, 1004, ENERGY)
    assert await hass.config_entries.async_unload(entry.entry_id)
    assert hass_storage[f"{DOMAIN}.{entry.entry_id}"]["data"]["charger"]["last"] == 1004
    # While stopped, the session went on
    await _wait(hass, freezer, 5)
    hass.states.async_set(CHARGER, "1007", ENERGY)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    [charge] = _charges(hass)
    assert charge["energy"] == 7 and charge["source"] == "charger"
    # A session left open across a long stop is closed at load: the next rise is a new charge
    assert await hass.config_entries.async_unload(entry.entry_id)
    await _wait(hass, freezer, 120)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    await _set(hass, CHARGER, 1010, ENERGY)
    assert [c["energy"] for c in _charges(hass)] == [3, 7]


async def test_older_store_without_charger_keys(hass: HomeAssistant, hass_storage: dict) -> None:
    from pytest_homeassistant_custom_component.common import MockConfigEntry

    hass_storage[f"{DOMAIN}.old"] = {
        "version": 1,
        "data": {
            "since": "2026-10-01T00:00:00+00:00",
            "odometer": 20000,
            "energy": {"ref": 30, "events": [{"time": "2026-10-02T00:00:00+00:00", "amount": 20}]},
        },
    }
    for entity, (state, attrs) in {ODOMETER: ("20000", KM), BATTERY: ("30", KWH), CHARGER: ("1000", ENERGY)}.items():
        hass.states.async_set(entity, state, attrs)
    entry = MockConfigEntry(
        domain=DOMAIN,
        entry_id="old",
        title="My car",
        data={"device_id": "x", "name": "My car"},
        options={CONF_ODOMETER: ODOMETER, CONF_BATTERY_ENERGY: BATTERY, CONF_CHARGER_ENERGY: CHARGER},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert [c["source"] for c in _charges(hass)] == ["auto"]
    await _set(hass, CHARGER, 1003, ENERGY)
    assert [c["source"] for c in _charges(hass)] == ["charger", "auto"]

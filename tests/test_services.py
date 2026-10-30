"""Tests for the actions: manual refuels and charges, reset."""

from __future__ import annotations

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ServiceValidationError

from custom_components.vehicle_consumption.const import (
    CONF_BATTERY_ENERGY,
    CONF_ELECTRICITY_PRICE,
    CONF_FUEL_PRICE,
    CONF_FUEL_QUANTITY,
    CONF_ODOMETER,
    DOMAIN,
)

from .conftest import BATTERY, FUEL, KM, KWH, LITERS, ODOMETER, setup_vehicle, state_of


async def test_add_refuel(hass: HomeAssistant) -> None:
    entry = await setup_vehicle(hass, {CONF_ODOMETER: ODOMETER, CONF_FUEL_QUANTITY: FUEL, CONF_FUEL_PRICE: 1.8})

    # Total cost given: the price is worked out
    await hass.services.async_call(
        DOMAIN,
        "add_refuel",
        {"config_entry_id": entry.entry_id, "liters": 40, "cost": 70, "odometer": 9990},
        blocking=True,
    )
    [refuel] = state_of(hass, "consumption").attributes["refuels"]
    assert refuel["liters"] == 40 and refuel["cost"] == 70 and refuel["price"] == 1.75
    assert refuel["odometer"] == 9990 and refuel["source"] == "manual"

    # Neither: the current price, and the last odometer reading
    await hass.services.async_call(
        DOMAIN, "add_refuel", {"config_entry_id": entry.entry_id, "liters": 10}, blocking=True
    )
    refuels = state_of(hass, "consumption").attributes["refuels"]
    assert len(refuels) == 2
    assert refuels[0]["cost"] == 18 and refuels[0]["price"] == 1.8 and refuels[0]["odometer"] == 10000

    # Price given: the cost is worked out
    await hass.services.async_call(
        DOMAIN, "add_refuel", {"config_entry_id": entry.entry_id, "liters": 10, "price": 2}, blocking=True
    )
    assert state_of(hass, "consumption").attributes["refuels"][0]["cost"] == 20

    # Manual events change no consumption
    total = state_of(hass, "consumption").attributes["total"]
    assert total["fuel"] == 0 and total["cost"] is None
    assert state_of(hass, "last_refuel").attributes["source"] == "manual"


async def test_add_charge(hass: HomeAssistant) -> None:
    states = {ODOMETER: ("10000", KM), BATTERY: ("30", KWH)}
    options = {CONF_ODOMETER: ODOMETER, CONF_BATTERY_ENERGY: BATTERY, CONF_ELECTRICITY_PRICE: 0.2}
    entry = await setup_vehicle(hass, options, states=states)
    await hass.services.async_call(
        DOMAIN, "add_charge", {"config_entry_id": entry.entry_id, "energy": 25}, blocking=True
    )
    [charge] = state_of(hass, "consumption").attributes["charges"]
    assert charge["energy"] == 25 and charge["cost"] == 5 and charge["source"] == "manual"


async def test_reset_statistics(hass: HomeAssistant) -> None:
    entry = await setup_vehicle(hass)
    hass.states.async_set(ODOMETER, "10100", KM)
    hass.states.async_set(FUEL, "34", LITERS)
    await hass.async_block_till_done()
    await hass.services.async_call(
        DOMAIN, "add_refuel", {"config_entry_id": entry.entry_id, "liters": 5}, blocking=True
    )
    assert state_of(hass, "consumption").attributes["total"]["distance"] == 100

    await hass.services.async_call(DOMAIN, "reset_statistics", {"config_entry_id": entry.entry_id}, blocking=True)
    attrs = state_of(hass, "consumption").attributes
    assert attrs["total"]["distance"] == 0 and attrs["refuels"] == [] and attrs["trips"] == []
    assert attrs["odometer"] == 10100

    # Tracking starts again from the current readings
    hass.states.async_set(ODOMETER, "10200", KM)
    hass.states.async_set(FUEL, "28", LITERS)
    await hass.async_block_till_done()
    assert state_of(hass, "consumption").state == "6.0"


async def test_two_vehicles(hass: HomeAssistant) -> None:
    """Each action applies to the vehicle of its entry only."""
    first = await setup_vehicle(hass)
    await setup_vehicle(
        hass,
        {CONF_ODOMETER: "sensor.van_odometer", CONF_FUEL_QUANTITY: "sensor.van_fuel"},
        name="Van",
        states={"sensor.van_odometer": ("500", KM), "sensor.van_fuel": ("60", LITERS)},
    )
    await hass.services.async_call(
        DOMAIN, "add_refuel", {"config_entry_id": first.entry_id, "liters": 5}, blocking=True
    )
    assert len(state_of(hass, "consumption").attributes["refuels"]) == 1
    assert state_of(hass, "consumption", "Van").attributes["refuels"] == []


async def test_errors(hass: HomeAssistant) -> None:
    entry = await setup_vehicle(hass)
    with pytest.raises(ServiceValidationError) as err:
        await hass.services.async_call(DOMAIN, "add_refuel", {"config_entry_id": "nope", "liters": 5}, blocking=True)
    assert err.value.translation_key == "entry_not_found"

    assert await hass.config_entries.async_unload(entry.entry_id)
    with pytest.raises(ServiceValidationError) as err:
        await hass.services.async_call(DOMAIN, "reset_statistics", {"config_entry_id": entry.entry_id}, blocking=True)
    assert err.value.translation_domain == DOMAIN and err.value.translation_key == "not_loaded"

    import voluptuous as vol

    with pytest.raises(vol.Invalid):
        await hass.services.async_call(
            DOMAIN, "add_refuel", {"config_entry_id": entry.entry_id, "liters": 0}, blocking=True
        )

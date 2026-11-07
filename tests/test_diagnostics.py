"""Tests for the diagnostics: entry, tracked figures and source sensors, personal data redacted."""

from __future__ import annotations

from homeassistant.components.diagnostics import REDACTED
from homeassistant.core import HomeAssistant

from custom_components.vehicle_consumption.const import CONF_FUEL_QUANTITY, CONF_ODOMETER
from custom_components.vehicle_consumption.diagnostics import async_get_config_entry_diagnostics

from .conftest import FUEL, KM, LITERS, ODOMETER, setup_vehicle


async def test_diagnostics_redacted(hass: HomeAssistant) -> None:
    vehicle = {
        "vin": "VF1RHN00012345678",
        "license_plate": "AB-123-CD",
        "latitude": 48.11,
        "longitude": -1.68,
        "account_id": "acc-42",
        "username": "julien@example.com",
    }
    entry = await setup_vehicle(
        hass, states={ODOMETER: ("10000", {**KM, **vehicle}), FUEL: ("40", {**LITERS, "location": "Rennes"})}
    )
    hass.states.async_set(ODOMETER, "10050", {**KM, **vehicle})
    await hass.async_block_till_done()

    # Called directly: the diagnostics test helper is missing from the minimum Home Assistant's test package.
    diag = await async_get_config_entry_diagnostics(hass, entry)

    assert diag["entry"]["options"] == {CONF_ODOMETER: ODOMETER, CONF_FUEL_QUANTITY: FUEL}
    assert diag["tracker"]["entry_id"] == entry.entry_id
    assert diag["tracker"]["odometer"] == 10050 and diag["tracker"]["driving"]
    assert diag["tracker"]["trip_gap_minutes"] == 30
    odometer = diag["sources"][CONF_ODOMETER]
    assert odometer["entity_id"] == ODOMETER and odometer["state"] == "10050"
    assert odometer["attributes"]["unit_of_measurement"] == "km"
    for key in vehicle:
        assert odometer["attributes"][key] == REDACTED
    assert diag["sources"][CONF_FUEL_QUANTITY]["attributes"]["location"] == REDACTED
    text = str(diag)
    for value in ("VF1RHN00012345678", "AB-123-CD", "48.11", "acc-42", "julien@example.com", "Rennes"):
        assert value not in text

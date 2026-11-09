"""The service reminder (log_service, Next service) and the CSV export."""

from __future__ import annotations

import csv

import pytest
from homeassistant.auth.models import User
from homeassistant.core import Context, HomeAssistant
from homeassistant.exceptions import ServiceValidationError, Unauthorized

from custom_components.vehicle_consumption.const import DOMAIN

from .conftest import KM, ODOMETER, setup_vehicle, state_of


async def test_next_service_counts_down_from_the_service_logged(hass: HomeAssistant) -> None:
    entry = await setup_vehicle(hass)
    data = {"config_entry_id": entry.entry_id}
    # Unknown until a service is logged.
    assert state_of(hass, "next_service").state == "unknown"
    # No interval yet: refused.
    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(DOMAIN, "log_service", data, blocking=True)

    await hass.services.async_call(DOMAIN, "log_service", {**data, "interval": 15000}, blocking=True)
    await hass.async_block_till_done()
    state = state_of(hass, "next_service")
    assert float(state.state) == 15000
    assert state.attributes["last_service_odometer"] == 10000
    assert state.attributes["interval"] == 15000
    assert state.attributes["overdue"] is False

    hass.states.async_set(ODOMETER, "26000", KM)
    await hass.async_block_till_done()
    state = state_of(hass, "next_service")
    assert float(state.state) == -1000
    assert state.attributes["overdue"] is True

    # The next service, at a given odometer, keeps the interval; kept across a reload.
    await hass.services.async_call(DOMAIN, "log_service", {**data, "odometer": 25500}, blocking=True)
    await entry.runtime_data.async_save()
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    assert float(state_of(hass, "next_service").state) == 14500

    # 0 turns it off.
    await hass.services.async_call(DOMAIN, "log_service", {**data, "interval": 0}, blocking=True)
    await hass.async_block_till_done()
    assert state_of(hass, "next_service").state == "unknown"


async def test_export_writes_the_trips_refuels_and_charges(hass: HomeAssistant, tmp_path) -> None:
    hass.config.config_dir = str(tmp_path)
    entry = await setup_vehicle(hass)
    data = {"config_entry_id": entry.entry_id}
    await hass.services.async_call(DOMAIN, "add_refuel", {**data, "liters": 40, "cost": 70}, blocking=True)
    result = await hass.services.async_call(DOMAIN, "export", data, blocking=True, return_response=True)
    assert result == {"path": str(tmp_path / "vehicle_consumption_my_car.csv"), "rows": 1}
    with open(result["path"], encoding="utf-8", newline="") as file:
        rows = list(csv.DictReader(file))
    assert rows[0]["type"] == "refuel"
    assert rows[0]["liters"] == "40.0"
    assert rows[0]["cost"] == "70.0"
    assert list(rows[0])[:3] == ["type", "start", "end"]

    for path in ("/etc/car.csv", ".storage/car.csv", "car.txt"):
        with pytest.raises(ServiceValidationError):
            await hass.services.async_call(
                DOMAIN, "export", {**data, "path": path}, blocking=True, return_response=True
            )


async def test_export_is_for_administrators(hass: HomeAssistant, hass_read_only_user: User, tmp_path) -> None:
    hass.config.config_dir = str(tmp_path)
    entry = await setup_vehicle(hass)
    with pytest.raises(Unauthorized):
        await hass.services.async_call(
            DOMAIN,
            "export",
            {"config_entry_id": entry.entry_id},
            blocking=True,
            return_response=True,
            context=Context(user_id=hass_read_only_user.id),
        )

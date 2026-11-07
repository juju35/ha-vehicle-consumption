"""Tests for the `vehicle_consumption_trip_ended` event."""

from __future__ import annotations

from datetime import timedelta

from freezegun.api import FrozenDateTimeFactory
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import async_capture_events, async_fire_time_changed

from custom_components.vehicle_consumption.const import (
    CONF_FUEL_PRICE,
    CONF_FUEL_QUANTITY,
    CONF_ODOMETER,
    CONF_TRIP_GAP,
    EVENT_TRIP_ENDED,
)

from .conftest import FUEL, KM, LITERS, ODOMETER, setup_vehicle

OPTIONS = {CONF_ODOMETER: ODOMETER, CONF_FUEL_QUANTITY: FUEL, CONF_TRIP_GAP: 30, CONF_FUEL_PRICE: 2.0}


async def _set(hass: HomeAssistant, odometer: float, fuel: float) -> None:
    hass.states.async_set(ODOMETER, str(odometer), KM)
    hass.states.async_set(FUEL, str(fuel), LITERS)
    await hass.async_block_till_done()


async def _wait(hass: HomeAssistant, freezer: FrozenDateTimeFactory, minutes: int) -> None:
    freezer.tick(timedelta(minutes=minutes))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()


async def test_trip_ended_event(hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> None:
    events = async_capture_events(hass, EVENT_TRIP_ENDED)
    entry = await setup_vehicle(hass, OPTIONS)
    assert events == []  # nothing at startup

    await _set(hass, 10020, 39)
    await _wait(hass, freezer, 20)
    await _set(hass, 10050, 37)
    await _wait(hass, freezer, 29)
    assert events == []  # still within the gap

    await _wait(hass, freezer, 2)
    [event] = events
    assert event.data == {
        "entry_id": entry.entry_id,
        "device_id": "device_My car",
        "vehicle": "My car",
        "start": event.data["start"],
        "end": event.data["end"],
        "duration": 20,
        "distance": 50.0,
        "fuel": 3.0,
        "energy": 0.0,
        "fuel_consumption": 6.0,
        "energy_consumption": 0.0,
        "cost": 6.0,
        "cost_per_km": 0.12,
        "co2": event.data["co2"],
        "co2_per_km": event.data["co2_per_km"],
    }
    assert event.data["co2"] > 0 and event.data["start"] < event.data["end"]

    # The tick goes on: the same trip is not announced twice.
    await _wait(hass, freezer, 10)
    assert len(events) == 1


async def test_no_event_without_distance_or_at_load(hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> None:
    events = async_capture_events(hass, EVENT_TRIP_ENDED)
    entry = await setup_vehicle(hass, OPTIONS)
    await _set(hass, 10050, 37)
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()

    # The open trip is closed at load after a restart: no event for it (it ended while stopped).
    freezer.tick(timedelta(hours=2))
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    await _wait(hass, freezer, 5)
    assert events == []

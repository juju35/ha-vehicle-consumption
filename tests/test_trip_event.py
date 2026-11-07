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
    await _wait(hass, freezer, 31)
    assert events == []  # closed, but a late odometer reading could still reopen it

    await _wait(hass, freezer, 35)
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
        "units": "metric",
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


async def test_one_event_for_a_trip_reopened_by_a_polled_odometer(
    hass: HomeAssistant, freezer: FrozenDateTimeFactory
) -> None:
    """An hourly odometer closes the trip between two readings of the same drive: one event, with the final figures."""
    events = async_capture_events(hass, EVENT_TRIP_ENDED)
    await setup_vehicle(hass, OPTIONS)
    await _set(hass, 10030, 38)
    await _wait(hass, freezer, 60)  # closed after 30 min, still not final
    assert events == []
    await _set(hass, 10130, 32)  # 100 km in the hour: the car never stopped, the trip is reopened
    await _wait(hass, freezer, 64)
    assert events == []
    await _wait(hass, freezer, 2)
    [event] = events
    assert event.data["distance"] == 130.0
    assert event.data["fuel"] == 8.0
    assert event.data["duration"] == 60

    await _wait(hass, freezer, 120)
    assert len(events) == 1


async def test_announced_trip_is_never_reopened(hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> None:
    """Once announced, a trip is final: a later reading starts a new trip, announced on its own."""
    events = async_capture_events(hass, EVENT_TRIP_ENDED)
    await setup_vehicle(hass, OPTIONS)
    await _set(hass, 10010, 39)
    await _wait(hass, freezer, 66)
    assert [e.data["distance"] for e in events] == [10.0]
    # 200 km since: `_drove_through` alone would have reopened it.
    await _set(hass, 10210, 27)
    await _wait(hass, freezer, 66)
    assert [e.data["distance"] for e in events] == [10.0, 200.0]


async def test_pending_trip_announced_when_another_starts(hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> None:
    """A new trip (not a reopening) makes the previous one final: it is announced right away."""
    events = async_capture_events(hass, EVENT_TRIP_ENDED)
    await setup_vehicle(hass, OPTIONS)
    await _set(hass, 10010, 39)
    await _wait(hass, freezer, 50)
    assert events == []
    await _set(hass, 10012, 39)  # 2 km after a 50-min stop: a new trip
    await _wait(hass, freezer, 1)
    assert [e.data["distance"] for e in events] == [10.0]

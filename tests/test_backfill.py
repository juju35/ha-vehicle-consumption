"""The last year kept: trips, refuels and charges for 365 days, the days not tracked yet counted at each start."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from freezegun.api import FrozenDateTimeFactory
from homeassistant.core import HomeAssistant

from custom_components.vehicle_consumption.const import DOMAIN, MAX_TRIPS

from .conftest import measured_trips
from .test_history import JOURNEY, START, _attrs, _record, _setup

# What a tracking started after the refuel of JOURNEY (minute 210) has: trip 3 only.
TRACKED_SINCE = START + timedelta(minutes=240)
TRIP_3 = {
    "start": (START + timedelta(minutes=300)).isoformat(),
    "end": (START + timedelta(minutes=300)).isoformat(),
    "distance": 50,
    "fuel": 3,
}


async def _store_tracking_from(hass: HomeAssistant, hass_storage: dict[str, Any], entry, **data: Any) -> None:
    """Unload the vehicle and make its store look like a tracking (imported) that started at `TRACKED_SINCE`."""
    await hass.config_entries.async_unload(entry.entry_id)
    stored = hass_storage[f"{DOMAIN}.{entry.entry_id}"]["data"]
    stored.pop("history_from", None)
    stored.update(
        since=TRACKED_SINCE.isoformat(),
        total={"distance": 50, "fuel": 3},
        months={"2026-10": {"distance": 50, "fuel": 3}},
        trips=[TRIP_3],
        fuel={**stored["fuel"], "events": []},
        **data,
    )


async def test_reload_counts_the_days_not_tracked(
    recorder_mock, hass: HomeAssistant, freezer: FrozenDateTimeFactory, hass_storage: dict[str, Any]
) -> None:
    """A reload adds what the recorder has before the tracking started; the tracked figures stay as they are."""
    await _record(hass, freezer, JOURNEY)
    entry = await _setup(hass, freezer)
    await _store_tracking_from(hass, hass_storage, entry)

    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done(wait_background_tasks=True)
    attrs = _attrs(hass)
    assert attrs["total"]["distance"] == 100 and attrs["total"]["fuel"] == 7
    assert attrs["total"]["since"] == START.isoformat()
    assert measured_trips(hass) == [(50, 3), (30, 2), (20, 2)]
    assert [(r["liters"], r["source"]) for r in attrs["refuels"]] == [(13, "auto")]
    assert attrs["month"]["distance"] == 100

    # Read once: another reload counts nothing twice.
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done(wait_background_tasks=True)
    attrs = _attrs(hass)
    assert attrs["total"]["distance"] == 100 and attrs["trip_count"] == 3 and attrs["refuel_count"] == 1


async def test_nothing_recorded_before_the_tracking(
    recorder_mock, hass: HomeAssistant, freezer: FrozenDateTimeFactory, hass_storage: dict[str, Any]
) -> None:
    """No reading before the tracking started: the tracked figures stay, nothing is wiped."""
    await _record(hass, freezer, JOURNEY[3:])
    entry = await _setup(hass, freezer)
    await _store_tracking_from(hass, hass_storage, entry)

    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done(wait_background_tasks=True)
    attrs = _attrs(hass)
    assert attrs["total"]["distance"] == 50 and attrs["total"]["since"] == TRACKED_SINCE.isoformat()
    assert [t["distance"] for t in attrs["trips"]] == [50]


async def test_a_year_kept(
    recorder_mock, hass: HomeAssistant, freezer: FrozenDateTimeFactory, hass_storage: dict[str, Any]
) -> None:
    """Trips and refuels are kept for 365 days (no longer the last 20); the attributes list the newest."""
    entry = await _setup(hass, freezer)
    now = START + timedelta(hours=6)

    def trip(days: float) -> dict[str, Any]:
        start = (now - timedelta(days=days)).isoformat()
        return {"start": start, "end": start, "distance": 10, "fuel": 1}

    def refuel(days: float) -> dict[str, Any]:
        return {"time": (now - timedelta(days=days)).isoformat(), "amount": 40, "source": "auto"}

    await hass.config_entries.async_unload(entry.entry_id)
    stored = hass_storage[f"{DOMAIN}.{entry.entry_id}"]["data"]
    stored.update(
        trips=[trip(d) for d in range(1, 361, 12)] + [trip(400)],
        fuel={**stored["fuel"], "events": [refuel(d) for d in (5, 200, 364, 366)]},
    )
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done(wait_background_tasks=True)

    attrs = _attrs(hass)
    assert attrs["trip_count"] == 30 and len(attrs["trips"]) == MAX_TRIPS
    assert attrs["refuel_count"] == 3 and len(attrs["refuels"]) == 3

    await hass.config_entries.async_unload(entry.entry_id)
    stored = hass_storage[f"{DOMAIN}.{entry.entry_id}"]["data"]
    assert len(stored["trips"]) == 30 and len(stored["fuel"]["events"]) == 3

    # A day later, the oldest refuel (364 days) is dropped.
    freezer.move_to(now + timedelta(days=2))
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done(wait_background_tasks=True)
    assert _attrs(hass)["refuel_count"] == 2

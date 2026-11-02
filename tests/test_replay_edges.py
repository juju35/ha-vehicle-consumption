"""A history replay at its edges: the month boundary in the hourly statistics, a trip being driven."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from homeassistant.core import HomeAssistant, State
from homeassistant.util import dt as dt_util

from .conftest import FUEL, KM, LITERS, ODOMETER, setup_vehicle

UTC = dt_util.UTC


def _rows(readings: list[tuple[datetime, str, str, dict[str, Any]]]) -> list[tuple[datetime, str, State]]:
    return [(t, e, State(e, v, a, last_changed=t, last_updated=t)) for t, e, v, a in readings]


def _figures(tracker) -> dict[str, Any]:
    def r(x: float | None) -> float | None:
        return None if x is None else round(x, 3)

    return {
        "total": (r(tracker.total.distance), r(tracker.total.fuel), r(tracker.total.cost)),
        "months": {k: (r(v.distance), r(v.fuel), r(v.cost)) for k, v in sorted(tracker.months.items())},
        "trips": sorted((t.start.isoformat(), r(t.totals.distance)) for t in tracker.trips),
    }


async def test_hourly_statistics_do_not_count_the_last_hour_of_a_kept_month_twice(hass: HomeAssistant) -> None:
    """A month kept as tracked, the next one replayed from hourly statistics: its last hour is counted once.

    An hourly statistic is read at the end of its hour: the hour 23:00-00:00 of 31 October is read at 00:00 on
    1 November but belongs to October, which the tracking already counted (and its trip).
    """
    await hass.config.async_set_time_zone("Europe/Paris")
    tz = ZoneInfo("Europe/Paris")

    def local(*args: int) -> datetime:
        return datetime(*args, tzinfo=tz).astimezone(UTC)

    now = local(2026, 11, 15, 12)
    entry = await setup_vehicle(hass, states={ODOMETER: ("5130", KM), FUEL: ("32.2", LITERS)})
    tracker = entry.runtime_data
    tracker._store.async_delay_save = lambda *a, **k: None

    def value(t: datetime) -> tuple[float, float]:
        """5000 km / 40 L, then 30 km / 1.8 L on 31 Oct 23:20-23:50, then 100 km / 6 L on 12 Nov 08:00-09:00."""
        if t >= local(2026, 11, 12, 9):
            return 5130.0, 32.2
        if t >= local(2026, 10, 31, 23, 50):
            return 5030.0, 38.2
        return 5000.0, 40.0

    live = [
        (local(2026, 9, 20), 5000.0, 40.0),
        (local(2026, 10, 31, 23, 35), 5015.0, 39.1),
        (local(2026, 10, 31, 23, 50), 5030.0, 38.2),
        (local(2026, 11, 12, 8, 30), 5050.0, 37.0),
        (local(2026, 11, 12, 9), 5130.0, 32.2),
    ]
    tracked = _rows([r for t, o, f in live for r in ((t, ODOMETER, str(o), KM), (t, FUEL, str(f), LITERS))])
    tracker._replay(tracked, set(), now)
    before = _figures(tracker)
    assert before["months"] == {"2026-10": (30, 1.8, None), "2026-11": (100, 6, None)}
    assert [d for _, d in before["trips"]] == [30, 20, 80]

    # The recorder: hourly statistics from 10 October (read at the end of each hour), the states from 5 November.
    hourly = []
    t = local(2026, 10, 10)
    while t < local(2026, 11, 5):
        odometer, fuel = value(t)
        hourly += [(t, ODOMETER, str(odometer), KM), (t, FUEL, str(fuel), LITERS)]
        t += timedelta(hours=1)
    states = [(local(2026, 11, 5), ODOMETER, "5030", KM), (local(2026, 11, 5), FUEL, "38.2", LITERS)]
    states += [(w, e, s.state, dict(s.attributes)) for w, e, s in tracked if w > local(2026, 11, 5)]
    tracker._replay(_rows([*hourly, *states]), set(), now, hourly_until=hourly[-1][0])

    # October kept as tracked, November replayed: nothing counted twice (it was 130 km / 7.8 L and the trip twice).
    assert _figures(tracker) == before


async def test_a_trip_being_driven_is_never_shortened(hass: HomeAssistant) -> None:
    """The odometer recorded only from the middle of the trip being driven: the trip keeps what was tracked of it."""
    now = datetime(2026, 11, 15, 12, 5, tzinfo=UTC)
    entry = await setup_vehicle(hass, states={ODOMETER: ("5060", KM), FUEL: ("36.4", LITERS)})
    tracker = entry.runtime_data
    tracker._store.async_delay_save = lambda *a, **k: None
    start = datetime(2026, 10, 1, tzinfo=UTC)
    truth = [(start, ODOMETER, "5000", KM), (start, FUEL, "40", LITERS)]
    for i in range(1, 7):  # 11:10 .. 12:00, 10 km every 10 minutes
        t = datetime(2026, 11, 15, 11, tzinfo=UTC) + timedelta(minutes=10 * i)
        truth += [(t, ODOMETER, str(5000 + 10 * i), KM), (t, FUEL, f"{40 - 0.6 * i:.1f}", LITERS)]
    tracker._reset_data(now)
    tracker._replay(_rows(truth), set(), now)
    tracker.trip_gap = timedelta(minutes=30)

    def driving() -> tuple[datetime, float]:
        assert tracker.trip is not None
        return tracker.trip.start, tracker.total.distance - tracker._trip_start.distance

    assert driving() == (datetime(2026, 11, 15, 11, 10, tzinfo=UTC), 60)

    # The fuel recorded all along (from before the tracking), the odometer only from 11:30 (HA restarted mid-trip).
    recorded = [r for r in truth if r[1] == FUEL]
    recorded += [r for r in truth if r[1] == ODOMETER and r[0] >= datetime(2026, 11, 15, 11, 30, tzinfo=UTC)]
    recorded.sort(key=lambda r: (r[0], r[1] != ODOMETER))
    tracker._replay(_rows(recorded), set(), now)

    # It was 30 km from 11:40: the tracked trip stays whole.
    assert driving() == (datetime(2026, 11, 15, 11, 10, tzinfo=UTC), 60)
    assert tracker.total.distance == 60

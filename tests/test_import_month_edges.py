"""A history import at a month end kept as tracked: deterministic cases found by tests/test_import_property.py.

- Hourly statistics are UTC hours: with a half-hour or quarter-hour offset, one of them spans the local midnight of
  the month end; what the tracking counted before that midnight is never counted again in the replayed month.
- Hourly means of a level (a `measurement` sensor): the last hour of the kept month does not leak into the next one.
- A drive across the month end whose part after midnight is replayed (the odometer recorded from the middle of it)
  is listed once.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from homeassistant.core import HomeAssistant, State
from homeassistant.util import dt as dt_util

from custom_components.vehicle_consumption import tracker as T
from custom_components.vehicle_consumption.const import CONF_FUEL_QUANTITY, CONF_ODOMETER

UTC = dt_util.UTC
KM = {"unit_of_measurement": "km"}
LITERS = {"unit_of_measurement": "L"}
ODO, FUEL = "sensor.r_odo", "sensor.r_fuel"


def fig(tr):
    return {
        "total": (round(tr.total.distance, 2), round(tr.total.fuel, 2)),
        "months": {k: (round(v.distance, 2), round(v.fuel, 2)) for k, v in sorted(tr.months.items())},
        "trips": [
            (dt_util.as_local(t.start).strftime("%m-%d %H:%M"), round(t.totals.distance, 1))
            for t in sorted(tr.trips, key=lambda t: t.start)
        ],
    }


def new(hass):
    tr = T.ConsumptionTracker(hass, "r", "R", {CONF_ODOMETER: ODO, CONF_FUEL_QUANTITY: FUEL})
    tr._changed = lambda: None
    return tr


def st(t, e, v):
    return (t, e, State(e, str(v), KM if e == ODO else LITERS, last_updated=t))


def drive_rows(L):
    """30 km / 1.8 L on the last evening of October (local), 100 km / 6 L on 12 Nov."""
    rows = [st(L(2026, 9, 20), ODO, 5000), st(L(2026, 9, 20), FUEL, 40)]
    for i in range(1, 7):  # 23:20 .. 23:50
        t = L(2026, 10, 31, 23, 15) + timedelta(minutes=5 * i)
        rows += [st(t, ODO, 5000 + 5 * i), st(t, FUEL, round(40 - 0.3 * i, 2))]
    for i in range(1, 11):
        t = L(2026, 11, 12, 8) + timedelta(minutes=6 * i)
        rows += [st(t, ODO, 5030 + 10 * i), st(t, FUEL, round(38.2 - 0.6 * i, 2))]
    return rows


def value_at(rows, e, t):
    v = None
    for w, ent, s in rows:
        if ent == e and w < t:
            v = float(s.state)
    return v


@pytest.mark.parametrize(
    "tz",
    [
        "Europe/Paris",
        "UTC",
        "America/New_York",
        "Asia/Kolkata",  # +5:30
        "America/St_Johns",  # -2:30 in summer
        "Australia/Adelaide",  # +10:30 in summer
        "Asia/Tehran",  # +3:30
        "Asia/Kathmandu",  # +5:45
    ],
)
async def test_hourly_month_end(hass: HomeAssistant, tz: str) -> None:
    """Hourly statistics (UTC hours, state at the end of each) from 10 Oct, states from 5 Nov, October kept."""
    await hass.config.async_set_time_zone(tz)
    z = ZoneInfo(tz)
    L = lambda *a: datetime(*a, tzinfo=z).astimezone(UTC)  # noqa: E731
    now = L(2026, 11, 15, 12)
    rows = drive_rows(L)
    hass.states.async_set(ODO, "5130", KM)
    hass.states.async_set(FUEL, "32.2", LITERS)
    tr = new(hass)
    tr._reset_data(L(2026, 9, 19))
    tr._replay(rows, set(), now)
    tracked = fig(tr)
    hourly = []
    h = datetime(2026, 10, 10, tzinfo=UTC)
    while h < L(2026, 11, 5):
        end = h + timedelta(hours=1)
        hourly += [st(end, ODO, value_at(rows, ODO, end)), st(end, FUEL, value_at(rows, FUEL, end))]
        h = end
    states = [
        st(L(2026, 11, 5), ODO, 5030),
        st(L(2026, 11, 5), FUEL, 38.2),
        *(r for r in rows if r[0] > L(2026, 11, 5)),
    ]
    tr._replay([*hourly, *states], set(), now, hourly_until=hourly[-1][0])
    imported = fig(tr)
    assert imported == tracked


@pytest.mark.parametrize("tz", ["Europe/Paris", "UTC", "Asia/Kolkata", "Asia/Kathmandu"])
async def test_hourly_means_month_end(hass: HomeAssistant, tz: str) -> None:
    """The same with the fuel quantity's statistics as hourly means (a `measurement` sensor)."""
    await hass.config.async_set_time_zone(tz)
    z = ZoneInfo(tz)
    L = lambda *a: datetime(*a, tzinfo=z).astimezone(UTC)  # noqa: E731
    now = L(2026, 11, 15, 12)
    rows = drive_rows(L)
    hass.states.async_set(ODO, "5130", KM)
    hass.states.async_set(FUEL, "32.2", LITERS)
    tr = new(hass)
    tr._reset_data(L(2026, 9, 19))
    tr._replay(rows, set(), now)
    tracked = fig(tr)
    fuel = [(w, float(s.state)) for w, e, s in rows if e == FUEL]

    def mean(h):
        acc, t = 0.0, h
        cur = value_at(rows, FUEL, h + timedelta(microseconds=1))
        for w, v in fuel:
            if h < w < h + timedelta(hours=1):
                acc += cur * (w - t).total_seconds()
                t, cur = w, v
        return (acc + cur * (h + timedelta(hours=1) - t).total_seconds()) / 3600

    hourly = []
    h = datetime(2026, 10, 10, tzinfo=UTC)
    while h < L(2026, 11, 5):
        end = h + timedelta(hours=1)
        hourly += [st(end, ODO, value_at(rows, ODO, end)), st(end, FUEL, round(mean(h), 4))]
        h = end
    states = [
        st(L(2026, 11, 5), ODO, 5030),
        st(L(2026, 11, 5), FUEL, 38.2),
        *(r for r in rows if r[0] > L(2026, 11, 5)),
    ]
    tr._replay([*hourly, *states], set(), now, hourly_until=hourly[-1][0])
    imported = fig(tr)
    assert imported["months"]["2026-11"][1] <= tracked["months"]["2026-11"][1] + 0.01


async def test_odometer_recorded_from_a_drive_across_the_month_end(hass: HomeAssistant) -> None:
    """States only: the fuel recorded all along, the odometer from 31 Oct 23:58 (a restart during a drive)."""
    await hass.config.async_set_time_zone("Europe/Paris")
    z = ZoneInfo("Europe/Paris")
    L = lambda *a: datetime(*a, tzinfo=z).astimezone(UTC)  # noqa: E731
    now = L(2026, 11, 15, 12)
    rows = [st(L(2026, 9, 20), ODO, 5000), st(L(2026, 9, 20), FUEL, 40)]
    for i in range(6):  # 23:42 .. 00:07, 5 km / 5 min
        t = L(2026, 10, 31, 23, 42) + timedelta(minutes=5 * i)
        rows += [st(t, ODO, 5005 + 5 * i), st(t, FUEL, round(39.7 - 0.3 * i, 2))]
    hass.states.async_set(ODO, "5030", KM)
    hass.states.async_set(FUEL, "38.2", LITERS)
    tr = new(hass)
    tr._reset_data(L(2026, 9, 19))
    tr._replay(rows, set(), now)
    tracked = fig(tr)
    start = L(2026, 10, 31, 23, 58)
    rec = [r for r in rows if r[1] == FUEL] + [st(start, ODO, 5020)] + [r for r in rows if r[1] == ODO and r[0] > start]
    rec.sort(key=lambda r: (r[0], r[1] != ODO))
    tr._replay(rec, set(), now)
    imported = fig(tr)
    assert imported == tracked


@pytest.mark.parametrize(
    ("tz", "october"),
    [
        ("Europe/Paris", 30.0),  # the hour ends at midnight: all of it in October
        ("Asia/Kolkata", 20.0),  # 10 km read at 23:30, then 23:30-00:30: half of its 20 km in October
        ("Asia/Kathmandu", 26.25),  # 25 km read at 23:45, then 23:45-00:45: a quarter of its 5 km in October
    ],
)
async def test_full_import_shares_an_hour_across_the_month_end(hass: HomeAssistant, tz: str, october: float) -> None:
    """Nothing tracked before (a full import): the UTC hour across the local midnight goes to both months in
    proportion; nothing lost nor counted twice (the months add up to the total, the odometer's 130 km)."""
    await hass.config.async_set_time_zone(tz)
    z = ZoneInfo(tz)
    L = lambda *a: datetime(*a, tzinfo=z).astimezone(UTC)  # noqa: E731
    now = L(2026, 11, 15, 12)
    rows = drive_rows(L)
    hass.states.async_set(ODO, "5130", KM)
    hass.states.async_set(FUEL, "32.2", LITERS)
    tr = new(hass)
    tr._reset_data(L(2026, 11, 14))
    hourly = []
    h = datetime(2026, 10, 10, tzinfo=UTC)
    while h < L(2026, 11, 5):
        end = h + timedelta(hours=1)
        hourly += [st(end, ODO, value_at(rows, ODO, end)), st(end, FUEL, value_at(rows, FUEL, end))]
        h = end
    states = [
        st(L(2026, 11, 5), ODO, 5030),
        st(L(2026, 11, 5), FUEL, 38.2),
        *(r for r in rows if r[0] > L(2026, 11, 5)),
    ]
    tr._replay([*hourly, *states], set(), now, hourly_until=hourly[-1][0])
    imported = fig(tr)
    assert imported["total"] == (130.0, 7.8)
    assert imported["months"]["2026-10"][0] == pytest.approx(october)
    assert imported["months"]["2026-11"][0] == pytest.approx(130.0 - october)
    assert sum(m[1] for m in imported["months"].values()) == pytest.approx(7.8, abs=0.02)  # months rounded


async def test_a_source_no_longer_recorded_is_not_counted_again(hass: HomeAssistant) -> None:
    """The fuel stopped being recorded at 23:36 on 31 Oct, 0.6 L before its current reading (within the tolerance
    of the import): the tracking counted those 0.6 L in October, kept; the replayed November does not add them."""
    await hass.config.async_set_time_zone("Europe/Paris")
    z = ZoneInfo("Europe/Paris")
    L = lambda *a: datetime(*a, tzinfo=z).astimezone(UTC)  # noqa: E731
    now = L(2026, 11, 15, 12)
    rows = [r for r in drive_rows(L) if r[0] < L(2026, 11, 1)]  # 30 km / 1.8 L on 31 Oct, 23:20-23:50
    hass.states.async_set(ODO, "5030", KM)
    hass.states.async_set(FUEL, "38.2", LITERS)
    tr = new(hass)
    tr._reset_data(L(2026, 9, 19))
    tr._replay(rows, set(), now)
    tracked = fig(tr)
    odo_from = L(2026, 10, 10)
    rec = [st(odo_from, ODO, 5000), *(r for r in rows if r[1] == ODO and r[0] > odo_from)]
    rec += [r for r in rows if r[1] == FUEL and r[0] <= L(2026, 10, 31, 23, 36)]
    rec.sort(key=lambda r: (r[0], r[1] != ODO))
    tr._replay(rec, set(), now)
    assert fig(tr) == tracked
    assert tr.months.get("2026-11", T.Totals()).fuel == 0

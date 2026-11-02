"""Property test of the history import: across time zones, tracking starts and recording starts of each source.

Ground truth: one timeline 1 Sep -> 15 Nov (trips across a local midnight at a month end, across the DST change, an
odometer unavailable for a day, refuels, three prices). "Tracked" = a live tracking from `since` (the states at
`since`, then every reading after it). "Recorded" = per source, the readings from the moment it started being
recorded (with the state at that moment, as a restart writes it). The import must never lose (against the tracked
figures) nor double (against the full replay) any km, L or cost, in the total, a month or a trip.
"""

from __future__ import annotations

import itertools
from copy import deepcopy
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from homeassistant.core import HomeAssistant, State
from homeassistant.util import dt as dt_util

from custom_components.vehicle_consumption.const import CONF_FUEL_PRICE_ENTITY, CONF_FUEL_QUANTITY, CONF_ODOMETER

from .conftest import FUEL, FUEL_PRICE, KM, LITERS, ODOMETER, setup_vehicle

PRICE = {"unit_of_measurement": "€/L"}
UTC = dt_util.UTC


def build(tz: ZoneInfo):
    L = lambda *a: datetime(*a, tzinfo=tz).astimezone(UTC)  # noqa: E731
    rows: list[tuple[datetime, str, str, dict]] = []
    odo, fuel = 5000.0, 40.0

    def drive(start: datetime, minutes: int, km_per_10: float):
        nonlocal odo, fuel
        for i in range(1, minutes // 10 + 1):
            t = start + timedelta(minutes=10 * i)
            odo += km_per_10
            fuel -= km_per_10 * 0.06
            rows.append((t, ODOMETER, f"{odo:.1f}", KM))
            rows.append((t, FUEL, f"{fuel:.2f}", LITERS))

    def refuel(t: datetime, to: float):
        nonlocal fuel
        fuel = to
        rows.append((t, FUEL, f"{fuel:.2f}", LITERS))

    rows.append((L(2026, 9, 1, 0), ODOMETER, f"{odo:.1f}", KM))
    rows.append((L(2026, 9, 1, 0), FUEL, f"{fuel:.2f}", LITERS))
    rows.append((L(2026, 9, 1, 0), FUEL_PRICE, "1.8", PRICE))
    drive(L(2026, 9, 10, 8), 60, 10)
    drive(L(2026, 9, 15, 9, 55), 30, 10)  # across a 15 Sep 10:00 since
    drive(L(2026, 9, 30, 23, 30), 60, 12)  # across the Oct 1 local midnight
    rows.append((L(2026, 10, 1, 6), FUEL_PRICE, "1.9", PRICE))
    drive(L(2026, 10, 5, 7), 40, 10)
    refuel(L(2026, 10, 6, 12), 50)
    rows.append((L(2026, 10, 8, 0), ODOMETER, "unavailable", KM))
    rows.append((L(2026, 10, 9, 0), ODOMETER, f"{odo:.1f}", KM))
    drive(L(2026, 10, 20, 11, 50), 30, 10)
    drive(L(2026, 10, 25, 1, 30), 120, 10)  # across the DST change (Europe: 03:00 -> 02:00)
    drive(L(2026, 10, 31, 23, 20), 70, 12)  # across the Nov 1 local midnight
    rows.append((L(2026, 11, 1, 6), FUEL_PRICE, "2.0", PRICE))
    refuel(L(2026, 11, 3, 12), 55)
    drive(L(2026, 11, 12, 8), 60, 25)
    rows.sort(key=lambda r: (r[0], r[1] != ODOMETER, r[1]))
    return rows


def state_at(rows, entity_id, when):
    """The state of `entity_id` at `when` (last reading at or before)."""
    last = None
    for t, e, v, a in rows:
        if e == entity_id and t <= when:
            last = (v, a)
    return last


def as_rows(readings):
    return [(t, e, State(e, v, a, last_changed=t, last_updated=t)) for t, e, v, a in readings]


def figures(tracker):
    return {
        "total": (round(tracker.total.distance, 3), round(tracker.total.fuel, 3), _r(tracker.total.cost)),
        "months": {k: (round(v.distance, 3), round(v.fuel, 3), _r(v.cost)) for k, v in sorted(tracker.months.items())},
        "trips": sorted(
            (
                t.start.isoformat(),
                (t.end or t.start).isoformat(),
                round(t.totals.distance, 3),
                round(t.totals.fuel, 3),
                _r(t.totals.cost),
            )
            for t in tracker.trips
        ),
        "since": tracker.since,
    }


def _r(x):
    return None if x is None else round(x, 3)


def check(T, X, F) -> list[str]:
    """What X (imported) lost against T (tracked) or doubled against F (the full truth replayed)."""
    errs = []
    eps = 1e-6
    # No doubling: total equals the sum of its months.
    for i, lab in ((0, "km"), (1, "L")):
        s = sum(m[i] for m in X["months"].values())
        if abs(s - X["total"][i]) > 0.01:
            errs.append(f"total {lab} {X['total'][i]} != sum months {s}")
    if X["total"][2] is not None:
        s = sum(m[2] or 0 for m in X["months"].values())
        if abs(s - X["total"][2]) > 0.05:
            errs.append(f"total cost {X['total'][2]} != sum months {s}")
    for k, t in T["months"].items():
        x = X["months"].get(k, (0, 0, None))
        f = F["months"].get(k, (0, 0, None))
        if x[0] < t[0] - 1 - eps:
            errs.append(f"{k} km lost {t[0]} -> {x[0]}")
        if x[1] < t[1] - max(1, 0.05 * t[1]) - eps:
            errs.append(f"{k} L lost {t[1]} -> {x[1]}")
        if x[0] > f[0] + eps:
            errs.append(f"{k} km DOUBLED {x[0]} > truth {f[0]}")
        if x[1] > f[1] + 0.01:
            errs.append(f"{k} L DOUBLED {x[1]} > truth {f[1]}")
        if t[2] is not None and (x[2] is None or x[2] < t[2] - max(1, 0.05 * t[2])):
            errs.append(f"{k} cost lost {t[2]} -> {x[2]}")
        if f[2] is not None and x[2] is not None and x[2] > f[2] + 0.05:
            errs.append(f"{k} cost DOUBLED {x[2]} > {f[2]}")
    for k, x in X["months"].items():
        f = F["months"].get(k, (0, 0, None))
        if x[0] > f[0] + eps:
            errs.append(f"{k} km DOUBLED {x[0]} > truth {f[0]}")
    # Trips: no overlap, none lost.
    trips = X["trips"]
    for a, b in itertools.pairwise(trips):
        if b[0] < a[1]:
            errs.append(f"overlapping trips {a} {b}")
    for t in T["trips"]:
        cover = [x for x in trips if x[0] <= t[1] and x[1] >= t[0]]
        if not cover or sum(x[2] for x in cover) < t[2] - 1:
            errs.append(f"trip lost {t} -> {cover}")
        if t[4] is not None and cover and any(x[4] is None for x in cover):
            errs.append(f"trip cost lost {t} -> {cover}")
    return errs


TZS = ["Europe/Paris", "UTC", "America/New_York"]


@pytest.mark.parametrize("tzname", TZS)
@pytest.mark.parametrize("price_recorded", [True, False])
async def test_import_never_loses_nor_doubles(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch, tzname: str, price_recorded: bool
) -> None:
    """250 imports per case (5 tracking starts x 10 x 10 recording starts): every path, no loss, no doubling."""
    await hass.config.async_set_time_zone(tzname)
    tz = ZoneInfo(tzname)
    L = lambda *a: datetime(*a, tzinfo=tz).astimezone(UTC)  # noqa: E731
    truth = build(tz)
    now = L(2026, 11, 15, 12)
    last = {e: state_at(truth, e, now) for e in (ODOMETER, FUEL, FUEL_PRICE)}
    entry = await setup_vehicle(
        hass,
        {CONF_ODOMETER: ODOMETER, CONF_FUEL_QUANTITY: FUEL, CONF_FUEL_PRICE_ENTITY: FUEL_PRICE},
        states=dict(last),
    )
    tracker = entry.runtime_data
    tracker._store.async_delay_save = lambda *a, **k: None
    prices = {FUEL_PRICE}
    # Which path each import took: months kept as tracked (merged), restored (the history had less), or replaced.
    paths: list[str] = []
    counts = dict.fromkeys(("replaced", "kept", "restored"), 0)
    merge_kept, restore = tracker._merge_kept, tracker._restore

    def merged(kept):
        paths.append("kept")
        return merge_kept(kept)

    def restored(snapshot):
        paths.append("restored")
        return restore(snapshot)

    monkeypatch.setattr(tracker, "_merge_kept", merged)
    monkeypatch.setattr(tracker, "_restore", restored)

    def replay(readings, initial=None):
        tracker._replay(as_rows(readings), prices, now, initial_prices=initial)

    def fresh():
        tracker._reset_data(now)
        tracker.history_imported = False

    # Full truth.
    fresh()
    replay(truth)
    F = figures(tracker)

    sinces = {
        "Sep15 10:00": L(2026, 9, 15, 10),
        "Oct1 00:00": L(2026, 10, 1, 0),
        "Oct1 00:03": L(2026, 10, 1, 0, 3),
        "Oct20 12:00": L(2026, 10, 20, 12),
        "Oct31 23:50": L(2026, 10, 31, 23, 50),
    }
    failures = []
    for sname, since in sinces.items():
        # Live tracking from `since`: the current states at since, then every reading after it.
        start = [(since, e, *state_at(truth, e, since)) for e in (ODOMETER, FUEL, FUEL_PRICE)]
        fresh()
        replay(start + [r for r in truth if r[0] > since])
        assert tracker.since == since
        tracked = tracker._snapshot()
        T = figures(tracker)
        starts = {
            "all": None,
            "-1m": since - timedelta(minutes=1),
            "+0": since,
            "+4m": since + timedelta(minutes=4),
            "+6m": since + timedelta(minutes=6),
            "Oct31 23:45": L(2026, 10, 31, 23, 45),
            "Nov1 00:00": L(2026, 11, 1, 0),
            "Nov1 00:10": L(2026, 11, 1, 0, 10),
            "Nov5": L(2026, 11, 5),
            "Nov14": L(2026, 11, 14),
        }
        for (oname, ostart), (fname, fstart) in itertools.product(starts.items(), starts.items()):
            readings = []
            for e, rs in ((ODOMETER, ostart), (FUEL, fstart)):
                if rs is not None and (st := state_at(truth, e, rs)) is not None:
                    readings.append((rs, e, *st))
                readings += [r for r in truth if r[1] == e and (rs is None or r[0] > rs)]
            initial = None
            if price_recorded:
                readings += [r for r in truth if r[1] == FUEL_PRICE]
            else:
                initial = {FUEL_PRICE: State(FUEL_PRICE, "unavailable", PRICE)}
            readings.sort(key=lambda r: (r[0], r[1] != ODOMETER, r[1]))
            tracker._restore(deepcopy(tracked))
            tracker.history_imported = False
            paths.clear()
            replay(readings, initial)
            X = figures(tracker)
            name = f"{tzname} price={'rec' if price_recorded else 'none'} since={sname} odo={oname} fuel={fname}"
            counts["restored" if "restored" in paths else "kept" if "kept" in paths else "replaced"] += 1
            if errs := check(T, X, F):
                failures.append(name + " :: " + "; ".join(errs))
    # The harness reaches every outcome: months kept as tracked, everything restored, and (with the prices recorded:
    # else a full replacement would lose the tracked cost) all replaced.
    assert counts["kept"] and counts["restored"] and (counts["replaced"] or not price_recorded), counts
    assert not failures, "\n".join(failures[:40]) + f"\n... {len(failures)} failures"

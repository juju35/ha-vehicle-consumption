"""Randomized property test of the history import, written independently of tests/test_replay_property.py.

Randomized property test of the history import, end to end through `async_import_history` with a fake recorder
(states with purge, hourly long-term statistics compiled from the recorded states, UTC hours).

Per scenario (seeded): a time zone, two vehicles (fuel car A, EV B) on 45-110 days of truth readings every 5 min
while driving (trips forced across local month ends and DST changes, refuels / charges in steps, unavailable flaps,
price changes), a live tracking from a random `since` per vehicle, a recorder config per entity (recorded from the
start / before / around / after since / around a month start / in the middle of a trip / excluded / only unavailable
/ stopped being recorded; statistics or not, `state` or `mean`), a purge window, an import over `days`, the same
import again, more live driving and a third import.

Invariant against the live tracking just before each import ("tracked") and a perfect live tracker from the first
reading ("perfect"): nothing tracked is lost (total, month, trip, open trip, cost: beyond the documented tolerance),
nothing is doubled (month <= perfect month, trip sums <= odometer moves, no refuel twice), total = sum of months,
trips do not overlap.

Hourly statistics cannot place what happened inside one hour: where a local month starts inside a UTC hour (a
half-hour or quarter-hour offset) or next to an hour of means (a level as a `measurement` sensor), the import shares
that hour between the two months. There, and only for months rebuilt from those hours (the tracking never has them:
an import keeps the tracked months that start in the hourly statistics), a month may differ from the perfect tracker
by what was driven / used in that window ("slack"); the total, every tracked figure and the trips stay exact.
V12_N scenarios (default 100), from seed V12_SEED; V12_TZ: the time zones; V12_OUT: a file for the summary.
"""

from __future__ import annotations

import bisect
import os
import random
from collections import Counter
from copy import deepcopy
from datetime import datetime, timedelta
from itertools import pairwise
from unittest.mock import patch
from zoneinfo import ZoneInfo

from homeassistant.core import HomeAssistant, State
from homeassistant.util import dt as dt_util

from custom_components.vehicle_consumption import tracker as T
from custom_components.vehicle_consumption.const import (
    CONF_BATTERY_ENERGY,
    CONF_ELECTRICITY_PRICE_ENTITY,
    CONF_FUEL_PRICE_ENTITY,
    CONF_FUEL_QUANTITY,
    CONF_ODOMETER,
    MAX_TRIPS,
)

UTC = dt_util.UTC
N = int(os.environ.get("V12_N", "100"))
SEED0 = int(os.environ.get("V12_SEED", "0"))
TZS = os.environ.get(
    "V12_TZ",
    "Europe/Paris,UTC,America/New_York,Asia/Kolkata,Australia/Adelaide,America/St_Johns,Asia/Tehran,Asia/Kathmandu",
).split(",")
OUT = os.environ.get("V12_OUT", "")
H = timedelta(hours=1)
M = timedelta(minutes=1)

ATTR = {
    "odo": {"unit_of_measurement": "km", "state_class": "total_increasing"},
    "fuel": {"unit_of_measurement": "L"},
    "batt": {"unit_of_measurement": "kWh"},
    "fprice": {"unit_of_measurement": "€/L"},
    "eprice": {"unit_of_measurement": "€/kWh"},
}
VEH = {
    "A": {"odo": "sensor.a_odo", "lvl": "sensor.a_fuel", "price": "sensor.a_price", "kind": "fuel"},
    "B": {"odo": "sensor.b_odo", "lvl": "sensor.b_batt", "price": "sensor.b_price", "kind": "energy"},
}
ATTRS = {
    "sensor.a_odo": ATTR["odo"],
    "sensor.a_fuel": ATTR["fuel"],
    "sensor.a_price": ATTR["fprice"],
    "sensor.b_odo": ATTR["odo"],
    "sensor.b_batt": ATTR["batt"],
    "sensor.b_price": ATTR["eprice"],
}

# Paths taken, counted (independent wrappers).
PATHS: Counter = Counter()
_orig_merge = T.ConsumptionTracker._merge_kept
_orig_restore = T.ConsumptionTracker._restore
_orig_cov = T.ConsumptionTracker._coverage
_CUR: list[str] = []


def _merge(self, kept):
    if os.environ.get("V12_DEBUG"):
        print(
            "MERGE cut",
            kept.cut,
            "key",
            kept.key,
            "hourlyAtCut",
            getattr(kept, "hourly_at_cut", None),
            "kept trips",
            [(t.start.strftime("%m-%d %H:%M"), round(t.totals.distance, 1)) for t in kept.trips][:4],
        )
        print(
            "  replay trips",
            [
                (t.start.strftime("%m-%d %H:%M"), (t.end or t.start).strftime("%H:%M"), round(t.totals.distance, 1))
                for t in self.trips
            ][:6],
            "open",
            self.trip and self.trip.start,
        )
    _CUR.append("kept" + ("H" if getattr(kept, "hourly_at_cut", False) else ""))
    return _orig_merge(self, kept)


def _restore(self, snap):
    _CUR.append("restored")
    return _orig_restore(self, snap)


def _cov(self, rows):
    c = _orig_cov(self, rows)
    if c is None:
        _CUR.append("nocov")
    return c


def floor_hour(t):
    return t.replace(minute=0, second=0, microsecond=0)


def month_starts(tz, a, b):
    out = []
    loc = a.astimezone(tz)
    y, m = loc.year, loc.month
    while True:
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
        s = datetime(y, m, 1, tzinfo=tz).astimezone(UTC)
        if s > b:
            return out
        out.append(s)


def dst_changes(tz, a, b):
    out, t = [], floor_hour(a)
    prev = t.astimezone(tz).utcoffset()
    while t < b:
        t += H
        off = t.astimezone(tz).utcoffset()
        if off != prev:
            out.append(t)
        prev = off
    return out


# ── Truth ────────────────────────────────────────────────────────────────────


def gen_vehicle(rng, tz, v, t0, t_end, opens):
    """Rows (when, entity_id, value) of one vehicle; `opens`: instants where a trip should be in progress."""
    odo_e, lvl_e, price_e, kind = v["odo"], v["lvl"], v["price"], v["kind"]
    rows = []
    odo = round(rng.uniform(1000, 90000), 1)
    cap = 55.0 if kind == "fuel" else 60.0
    lvl = round(rng.uniform(25, cap), 2)
    rate = 0.065 if kind == "fuel" else 0.17
    rows += [(t0, odo_e, f"{odo:.1f}"), (t0 + timedelta(seconds=rng.randint(0, 50)), lvl_e, f"{lvl:.2f}")]
    pv = rng.uniform(1.6, 2.1) if kind == "fuel" else rng.uniform(0.15, 0.3)
    rows.append((t0, price_e, f"{pv:.3f}"))
    for _ in range(rng.randint(0, 5)):
        pv *= rng.uniform(0.9, 1.1)
        rows.append((t0 + (t_end - t0) * rng.random(), price_e, f"{pv:.3f}"))
    # Trip starts.
    edges = month_starts(tz, t0, t_end)
    dsts = dst_changes(tz, t0, t_end)
    cands = []
    for _ in range(rng.randint(5, 14)):
        r = rng.random()
        if r < 0.35 and edges:
            s = rng.choice(edges) - timedelta(minutes=rng.uniform(1, 75))
        elif r < 0.5 and dsts:
            s = rng.choice(dsts) - timedelta(minutes=rng.uniform(0, 150))
        else:
            s = t0 + H + (t_end - t0 - 2 * H) * rng.random()
        cands.append((s, rng.choice([5, 10, 15, 25, 40, 60, 90, 150])))
    cands.extend((o - timedelta(minutes=rng.uniform(6, 50)), 240) for o in opens)
    cands.sort()
    trips = []
    last_end = t0 + 30 * M
    for begin, dur in cands:
        if begin < last_end + 3 * M or begin >= t_end:
            continue
        s = begin.replace(microsecond=0)
        steps = max(1, dur // 5)
        t = s
        for k in range(steps):
            t = s + timedelta(minutes=5 * k)
            if t >= t_end:
                break
            km = round(rng.uniform(2, 9), 1)
            odo = round(odo + km, 1)
            lvl = round(max(0.5, lvl - km * rate), 2)
            rows.append((t, odo_e, f"{odo:.1f}"))
            rows.append((t + timedelta(seconds=rng.randint(0, 50)), lvl_e, f"{lvl:.2f}"))
        trips.append((s, t))
        last_end = t
        # Refuel / charge some time after the trip.
        if lvl < cap * 0.45 and rng.random() < 0.8:
            r0 = t + timedelta(minutes=rng.uniform(70, 300))
            if kind == "fuel":
                lvl = round(cap - rng.uniform(0, 3), 2)
                rows.append((r0, lvl_e, f"{lvl:.2f}"))
                last_end = max(last_end, r0 + 70 * M)
            else:
                rt = r0
                while lvl < cap - 5:
                    lvl = round(min(cap, lvl + rng.uniform(3, 8)), 2)
                    rows.append((rt, lvl_e, f"{lvl:.2f}"))
                    rt += 15 * M
                last_end = max(last_end, rt + 70 * M)
    # Unavailable flaps of the odometer or the level.
    for _ in range(rng.randint(0, 3)):
        e = rng.choice([odo_e, lvl_e])
        a = t0 + H + (t_end - t0 - 2 * H) * rng.random()
        d = timedelta(minutes=rng.choice([2, 20, 90, 600, 1500]))
        inside = [r for r in rows if r[1] == e and a <= r[0] < a + d]
        before = [r for r in rows if r[1] == e and r[0] <= a + d]
        rows = [r for r in rows if r not in inside]
        rows.append((a, e, "unavailable"))
        last = max(before, key=lambda r: r[0])[2] if before else None
        if last and last != "unavailable":
            rows.append((a + d, e, last))
    rows = [r for r in rows if r[0] <= t_end]
    rows.sort(key=lambda r: (r[0], r[1] != odo_e, r[1]))
    return rows, trips


# ── Fake recorder ────────────────────────────────────────────────────────────


class Recorder:
    def __init__(self, truth, cfg, keep_days):
        self.truth = truth  # eid -> sorted [(when, value)]
        self.cfg = cfg  # eid -> dict(start, end, mode, stats)
        self.keep = timedelta(days=keep_days)
        self.now = None

    def recorded(self, eid):
        c = self.cfg.get(eid)
        if c is None or c["mode"] == "excluded":
            return []
        rows = self.truth[eid]
        start, end = c["start"], c["end"] or datetime.max.replace(tzinfo=UTC)
        out = []
        i = bisect.bisect_right([w for w, _ in rows], start) - 1
        if i >= 0:
            out.append((start, rows[i][1]))  # the state written when it starts being recorded
        out += [(w, v) for w, v in rows if start < w < end and w <= self.now]
        if c["mode"] == "unavail":
            out = [(w, "unavailable") for w, _ in out]
        return [(w, v) for w, v in out if w <= self.now]

    def get_significant_states(self, hass, start, end, entity_ids, include_start_time_state=True, **kw):
        cutoff = self.now - self.keep
        out = {}
        for eid in entity_ids:
            rec = [(w, v) for w, v in self.recorded(eid) if w >= cutoff]
            states = [State(eid, v, ATTRS[eid], last_changed=w, last_updated=w) for w, v in rec if w > start]
            if include_start_time_state:
                prior = [(w, v) for w, v in rec if w <= start]
                if prior:
                    states.insert(0, State(eid, prior[-1][1], ATTRS[eid], last_changed=start, last_updated=start))
            if states:
                out[eid] = states
        return out

    def statistics_during_period(self, hass, start, end, ids, period, units, types):
        out = {}
        for eid in ids:
            c = self.cfg.get(eid)
            if c is None or c["mode"] in ("excluded", "unavail") or not c["stats"]:
                continue
            rec = self.recorded(eid)
            if not rec:
                continue
            times = [w for w, _ in rec]
            h = floor_hour(rec[0][0])
            if h < rec[0][0]:
                h += H
            stop = min(c["end"] or self.now, self.now)
            rows = []
            while h + H <= stop:
                if start <= h < end:
                    i = bisect.bisect_left(times, h + H) - 1  # last recorded state before the hour's end
                    j = bisect.bisect_right(times, h) - 1  # the state at the hour's start
                    in_hour = [v for _, v in rec[max(j, 0) : i + 1]]
                    valid = [float(v) for v in in_hour if v not in ("unavailable", "unknown")]
                    if valid and i >= 0:
                        # last valid value up to the end of the hour
                        last = next(float(v) for _, v in reversed(rec[: i + 1]) if v not in ("unavailable", "unknown"))
                        row = {"start": h.timestamp(), "end": (h + H).timestamp()}
                        if c["stats"] == "mean":
                            # time-weighted mean over the hour
                            acc, t, cur = 0.0, h, None
                            k = j
                            cur = (
                                float(rec[k][1]) if k >= 0 and rec[k][1] not in ("unavailable", "unknown") else valid[0]
                            )
                            for w, v in rec[max(j + 1, 0) : i + 1]:
                                acc += cur * (w - t).total_seconds()
                                t = w
                                if v not in ("unavailable", "unknown"):
                                    cur = float(v)
                            acc += cur * (h + H - t).total_seconds()
                            row["mean"] = acc / 3600
                            row["state"] = None
                        else:
                            row["state"] = last
                            row["mean"] = None
                        rows.append(row)
                h += H
            if rows:
                out[eid] = rows
        return out


# ── Live tracking ────────────────────────────────────────────────────────────


def tick(tr, t):
    if tr.trip is not None and tr.trip.end is not None and tr.trip.end + tr.trip_gap <= t:
        tr._end_trip_if_stopped(tr.trip.end + tr.trip_gap)


def figures(tr, now):
    open_trip = None
    if tr.trip is not None:
        open_trip = (tr.trip.start, tr.trip.end or now, tr.total.distance - tr._trip_start.distance)
    return {
        "total": deepcopy(tr.total),
        "months": deepcopy(tr.months),
        "trips": [(t.start, t.end, t.totals.distance) for t in tr.trips],
        "open": open_trip,
        "events": {k: [(e.time, e.amount, e.source) for e in lv.events] for k, lv in tr._levels.items()},
    }


def tol(v):
    return max(1.0, 0.05 * v) + 1e-6


def check(tag, kind, before, after, perfect, odo_at, now, exact_level, max_price, slack=None):
    errs = []
    b, a = before, after

    def lost(new, old, where):
        if new.distance < old.distance - 1.0 - 1e-6:
            errs.append(f"{tag} {where}: distance lost {old.distance:.1f} -> {new.distance:.1f}")
        ov, nv = getattr(old, kind), getattr(new, kind)
        if nv < ov - tol(ov):
            errs.append(f"{tag} {where}: {kind} lost {ov:.2f} -> {nv:.2f}")
        if old.cost is not None and (new.cost is None or new.cost < old.cost - tol(old.cost)):
            errs.append(f"{tag} {where}: cost lost {old.cost:.2f} -> {new.cost}")

    lost(a["total"], b["total"], "total")
    for k, old in b["months"].items():
        lost(a["months"].get(k, T.Totals()), old, f"month {k}")
    # No doubling against a perfect tracker.
    for k, new in a["months"].items():
        p = perfect["months"].get(k, T.Totals())
        s_km, s_lvl = (slack or {}).get(k, (0.0, 0.0))
        if new.distance > p.distance + 0.05 + s_km:
            errs.append(f"{tag} month {k}: distance doubled {new.distance:.1f} > perfect {p.distance:.1f}")
        nv, pv = getattr(new, kind), getattr(p, kind)
        if nv > pv + (0.05 if exact_level else tol(pv)) + s_lvl:
            errs.append(f"{tag} month {k}: {kind} doubled {nv:.2f} > perfect {pv:.2f}")
        if new.cost is not None and new.cost > nv * max_price + 0.05:
            errs.append(f"{tag} month {k}: cost {new.cost:.2f} > {kind} x max price")
    if a["total"].distance > perfect["total"].distance + 0.05:
        errs.append(f"{tag} total distance doubled {a['total'].distance:.1f} > {perfect['total'].distance:.1f}")
    # Total = sum of months.
    sd = sum(m.distance for m in a["months"].values())
    sl = sum(getattr(m, kind) for m in a["months"].values())
    if abs(sd - a["total"].distance) > 0.05 or abs(sl - getattr(a["total"], kind)) > 0.05:
        errs.append(
            f"{tag} total {a['total'].distance:.1f}/{getattr(a['total'], kind):.2f} != months {sd:.1f}/{sl:.2f}"
        )
    if a["total"].cost is not None:
        sc = sum(m.cost or 0 for m in a["months"].values())
        if abs(sc - a["total"].cost) > 0.05:
            errs.append(f"{tag} total cost {a['total'].cost:.2f} != months {sc:.2f}")
    # Trips: no overlap, nothing lost or shortened, no doubling.
    trips = sorted(a["trips"])
    trips_o = [*trips, a["open"]] if a["open"] else trips
    for x, y in pairwise(trips_o):
        if y[0] <= x[1]:
            errs.append(f"{tag} trips overlap {x[0]:%m-%d %H:%M}-{x[1]:%H:%M} / {y[0]:%m-%d %H:%M}")
    floor = trips[0][0] if len(a["trips"]) >= MAX_TRIPS else datetime.min.replace(tzinfo=UTC)
    tracked = list(b["trips"]) + ([b["open"]] if b["open"] else [])
    for s, e, d in tracked:
        if d <= 0 or e < floor:
            continue
        cover = [x for x in trips_o if x[0] <= e + 61 * M and x[1] >= s - 61 * M]
        if not cover or max(x[2] for x in cover) < d - 1.0 - 1e-6:
            errs.append(
                f"{tag} trip {s:%m-%d %H:%M}-{e:%H:%M} {d:.1f} km lost/shortened -> "
                + ", ".join(f"{x[0]:%m-%d %H:%M} {x[2]:.1f}" for x in cover)
            )
    if b["open"] and b["open"][2] > 0:
        s, e, d = b["open"]
        if not a["open"] or a["open"][0] > s + M or a["open"][2] < d - 1.0 - 1e-6:
            errs.append(
                f"{tag} open trip {s:%m-%d %H:%M} {d:.1f} km -> "
                f"{a['open'] and (a['open'][0].strftime('%m-%d %H:%M'), round(a['open'][2], 1))}"
            )
    for i in range(len(trips_o)):
        acc = 0.0
        for j in range(i, len(trips_o)):
            acc += trips_o[j][2]
            room = odo_at(trips_o[j][1]) - odo_at(trips_o[i][0] - 61 * M)
            if acc > room + 0.05:
                errs.append(
                    f"{tag} trips {trips_o[i][0]:%m-%d %H:%M}..{trips_o[j][0]:%m-%d %H:%M} "
                    f"sum {acc:.1f} > driven {room:.1f}"
                )
                break
    # Refuels / charges: none twice, none lost.
    ev_a = sorted(x for x in a["events"][kind] if x[2] != "manual")
    for x, y in pairwise(ev_a):
        if y[0] - x[0] <= 61 * M and abs(y[1] - x[1]) < 0.5:
            errs.append(f"{tag} refuel twice {x[0]:%m-%d %H:%M} {x[1]:.1f} / {y[0]:%m-%d %H:%M} {y[1]:.1f}")
    ev_floor = ev_a[0][0] if len(ev_a) >= 20 else datetime.min.replace(tzinfo=UTC)
    for t, amt, src in b["events"][kind]:
        if src == "manual" or t < ev_floor:
            continue
        near = sum(x[1] for x in ev_a if abs(x[0] - t) <= 13 * H)
        if near < amt - tol(amt):
            errs.append(f"{tag} refuel {t:%m-%d %H:%M} {amt:.1f} lost -> {near:.1f}")
    return errs


def rec_cfg(rng, eid, since, t0, now, trips, edges, is_price=False):
    modes = ["all", "before", "near", "after", "edge", "midtrip", "excluded", "unavail", "stopped"]
    w = [30, 10, 12, 14, 12, 12, 4, 3, 3]
    mode = rng.choices(modes, w)[0]
    start, end = t0 - H, None
    if mode == "before":
        start = since - timedelta(hours=rng.uniform(1, 400))
    elif mode == "near":
        start = since + timedelta(minutes=rng.choice([-10, -5, -1, 0, 1, 4, 6, 10, 59, 61]))
    elif mode == "after":
        start = since + (now - since) * rng.random()
    elif mode == "edge":
        later = [e for e in edges if e > since - 2 * H] or edges or [since]
        start = rng.choice(later) + timedelta(minutes=rng.choice([-61, -30, -5, 0, 5, 30, 61]))
    elif mode == "midtrip":
        later = [t for t in trips if t[1] > since] or trips
        if later:
            s, e = rng.choice(later)
            start = s + (e - s) * rng.random() + timedelta(seconds=rng.randint(1, 120))
    elif mode == "stopped":
        start = t0 - H
        end = since + (now - since) * rng.random()
    start = max(start, t0 - H)
    stats = rng.choices([False, "state", "mean"], [25, 60, 15])[0]
    if is_price:
        stats = rng.choice([False, "mean"])
    if "odo" in eid and stats == "mean":
        stats = "state"
    return {"mode": mode, "start": start, "end": end, "stats": stats}


async def run_scenario(hass, freezer, seed):
    rng = random.Random(seed)
    tzname = TZS[seed % len(TZS)]
    await hass.config.async_set_time_zone(tzname)
    tz = ZoneInfo(tzname)
    t0 = datetime(2026, 1, 5, tzinfo=UTC) + timedelta(days=rng.uniform(0, 330), minutes=rng.randint(0, 1439))
    t0 = t0.replace(second=0, microsecond=0)
    now1 = t0 + timedelta(days=rng.uniform(45, 110), minutes=rng.randint(0, 59))
    now2 = now1 + timedelta(days=rng.choice([0.2, 1, 5, 15, 40]))
    opens = [n for n in (now1, now2) if rng.random() < 0.35]
    truth_rows = []
    trips_of = {}
    for name, v in VEH.items():
        rows, trips = gen_vehicle(rng, tz, v, t0, now2, opens)
        truth_rows += rows
        trips_of[name] = trips
    truth_rows.sort(key=lambda r: (r[0], "odo" not in r[1], r[1]))
    truth = {}
    for w, e, val in truth_rows:
        truth.setdefault(e, []).append((w, val))
    edges = month_starts(tz, t0, now2)

    def odo_at_factory(eid):
        rows = [(w, float(v)) for w, v in truth[eid] if v != "unavailable"]
        times = [w for w, _ in rows]

        def at(t):
            i = bisect.bisect_right(times, t) - 1
            return rows[i][1] if i >= 0 else rows[0][1]

        return at

    # Per vehicle: since, options, recorder config.
    setup = {}
    cfg = {}
    for name, v in VEH.items():
        r = rng.random()
        if r < 0.25 and edges:
            since = rng.choice([e for e in edges if e < now1] or [t0 + H]) + timedelta(
                minutes=rng.choice([-3, 0, 2, 7])
            )
        elif r < 0.45 and trips_of[name]:
            s, e = rng.choice(trips_of[name])
            since = s + (e - s) * rng.random()
        else:
            since = t0 + timedelta(hours=1) + (now1 - t0 - 2 * H) * rng.random()
        since = min(max(since, t0 + 10 * M), now1 - 10 * M)
        price_mode = rng.choice(["none", "recorded", "excluded_unavail", "excluded_avail"])
        options = {CONF_ODOMETER: v["odo"], "trip_gap": rng.choice([10, 30, 30, 45])}
        options[CONF_FUEL_QUANTITY if v["kind"] == "fuel" else CONF_BATTERY_ENERGY] = v["lvl"]
        if price_mode != "none":
            options[CONF_FUEL_PRICE_ENTITY if v["kind"] == "fuel" else CONF_ELECTRICITY_PRICE_ENTITY] = v["price"]
        setup[name] = {"since": since, "options": options, "price_mode": price_mode}
        for key in ("odo", "lvl"):
            cfg[v[key]] = rec_cfg(rng, v[key], since, t0, now2, trips_of[name], edges)
        if price_mode == "recorded":
            cfg[v["price"]] = rec_cfg(rng, v["price"], since, t0, now2, trips_of[name], edges, is_price=True)
            cfg[v["price"]]["mode"] = (
                "all" if cfg[v["price"]]["mode"] in ("excluded", "unavail") else cfg[v["price"]]["mode"]
            )
        else:
            cfg[v["price"]] = {"mode": "excluded", "start": t0, "end": None, "stats": False}
    rec = Recorder(truth, cfg, rng.choice([10, 10, 3, 30]))
    days = rng.choice([60, 60, 10, 30, 730, 5])

    trackers, perfect = {}, {}
    for name in VEH:
        p = T.ConsumptionTracker(hass, f"p{name}{seed}", f"P{name}", setup[name]["options"])
        p._changed = lambda: None
        p._reset_data(t0 - M)
        perfect[name] = p
    max_price = {"A": 3.0, "B": 0.5}

    pos = 0

    def live_until(t_stop):
        nonlocal pos
        while pos < len(truth_rows) and truth_rows[pos][0] <= t_stop:
            w, e, val = truth_rows[pos]
            pos += 1
            for name in VEH:
                if name not in trackers and w >= setup[name]["since"]:
                    start_tracker(name)
            for tr in [*trackers.values(), *perfect.values()]:
                tick(tr, w)
            hass.states.async_set(e, val, ATTRS[e])
            st = State(e, val, ATTRS[e], last_changed=w, last_updated=w)
            for tr in [*trackers.values(), *perfect.values()]:
                for key, eid in tr.sensors.items():
                    if eid == e:
                        tr._process(key, st, w)
        for name in VEH:
            if name not in trackers and t_stop >= setup[name]["since"]:
                start_tracker(name)
        for tr in [*trackers.values(), *perfect.values()]:
            tick(tr, t_stop)

    def start_tracker(name):
        tr = T.ConsumptionTracker(hass, f"t{name}{seed}", name, setup[name]["options"])
        tr._changed = lambda: None
        tr._reset_data(setup[name]["since"])
        tr._read_current(setup[name]["since"])
        trackers[name] = tr

    slack = {name: {} for name in VEH}

    def add_slack(name, v, now):
        """Months next to a local month start that the hourly statistics of this import cannot place exactly."""
        cutoff = now - rec.keep
        firsts = []
        for e in (v["odo"], v["lvl"]):
            valid = [w for w, val in rec.recorded(e) if w >= cutoff and val not in ("unavailable", "unknown")]
            firsts.append(valid[0] if valid else now)
        era_end = max(firsts)  # the first recorded state of each source still counts since its last hour
        means = cfg[v["lvl"]]["stats"] == "mean"
        odo = odo_at_factory(v["odo"])
        lvl_rows = [(w, float(x)) for w, x in truth[v["lvl"]] if x != "unavailable"]
        for b in month_starts(tz, t0 - timedelta(days=40), era_end):
            aligned = b.minute == 0 and b.second == 0
            if aligned and not means:
                continue
            lo, hi = floor_hour(b), floor_hour(b) + (0 * H if aligned else H)
            if means:
                lo, hi = lo - H, hi + 2 * H  # a mean stands for the middle of its hour
            if lo > era_end:
                continue
            km = 0.0 if aligned else odo(hi) - odo(lo)
            used = sum(max(0.0, a - c) for (_, a), (w, c) in pairwise(lvl_rows) if lo < w <= hi)
            for key in (
                dt_util.as_local(b - timedelta(microseconds=1)).strftime("%Y-%m"),
                dt_util.as_local(b).strftime("%Y-%m"),
            ):
                old = slack[name].get(key, (0.0, 0.0))
                slack[name][key] = (max(old[0], km), max(old[1], used))

    for eid in ATTRS:
        hass.states.async_remove(eid)
    errs = []
    paths = []

    async def import_all(now, label):
        rec.now = now
        freezer.move_to(now)
        saved = {}
        for name, v in VEH.items():
            if setup[name]["price_mode"] == "excluded_unavail":
                saved[v["price"]] = hass.states.get(v["price"])
                hass.states.async_set(v["price"], "unavailable", ATTRS[v["price"]])
        for name, tr in trackers.items():
            v = VEH[name]
            before = figures(tr, now)
            _CUR.clear()
            if os.environ.get("V12_DEBUG"):
                print(
                    "IMPORT",
                    name,
                    label,
                    "since",
                    tr.since,
                    "tracked trips",
                    [(t[0].strftime("%m-%d %H:%M"), t[1].strftime("%H:%M"), round(t[2], 1)) for t in before["trips"]][
                        :6
                    ],
                    before["open"],
                )
            await tr.async_import_history(days)
            if os.environ.get("V12_DEBUG"):
                print(
                    "  after trips",
                    [
                        (t.start.strftime("%m-%d %H:%M"), t.end.strftime("%H:%M"), round(t.totals.distance, 1))
                        for t in tr.trips
                    ][:6],
                )
            path = "+".join(_CUR) or "full"
            paths.append(path)
            PATHS[path] += 1
            after = figures(tr, now)
            if os.environ.get("V12_DEBUG"):
                pf0 = figures(perfect[name], now)
                print(
                    "  MONTHS before",
                    {k: (round(m.distance, 1), round(getattr(m, v["kind"]), 2)) for k, m in before["months"].items()},
                )
                print(
                    "  MONTHS after ",
                    {k: (round(m.distance, 1), round(getattr(m, v["kind"]), 2)) for k, m in after["months"].items()},
                )
                print(
                    "  MONTHS perf  ",
                    {k: (round(m.distance, 1), round(getattr(m, v["kind"]), 2)) for k, m in pf0["months"].items()},
                )
            pf = figures(perfect[name], now)
            add_slack(name, v, now)
            exact = cfg[v["lvl"]]["stats"] != "mean"
            errs.extend(
                check(
                    f"seed={seed} {tzname} {name} {label} [{path}] since={setup[name]['since']:%m-%d %H:%M} "
                    f"odo={cfg[v['odo']]['mode']}/{cfg[v['odo']]['stats']} "
                    f"lvl={cfg[v['lvl']]['mode']}/{cfg[v['lvl']]['stats']} "
                    f"price={setup[name]['price_mode']} days={days} keep={rec.keep.days}",
                    v["kind"],
                    before,
                    after,
                    pf,
                    odo_at_factory(v["odo"]),
                    now,
                    exact,
                    max_price[name],
                    slack[name],
                )
            )
        for eid, st in saved.items():
            if st is not None:
                hass.states.async_set(eid, st.state, st.attributes)

    with (
        patch("homeassistant.components.recorder.get_instance") as gi,
        patch("homeassistant.components.recorder.history.get_significant_states", rec.get_significant_states),
        patch("homeassistant.components.recorder.statistics.statistics_during_period", rec.statistics_during_period),
        patch.object(T.ConsumptionTracker, "_merge_kept", _merge),
        patch.object(T.ConsumptionTracker, "_restore", _restore),
        patch.object(T.ConsumptionTracker, "_coverage", _cov),
    ):

        async def run(f, *a):
            return f(*a)

        gi.return_value.async_add_executor_job = run
        hass.config.components.add("recorder")
        live_until(now1)
        await import_all(now1, "import1")
        await import_all(now1, "import1-again")
        live_until(now2)
        await import_all(now2, "import2")
    return errs, paths


async def test_v12_property(hass: HomeAssistant, freezer) -> None:
    import homeassistant.components.recorder.history  # noqa: F401
    import homeassistant.components.recorder.statistics  # noqa: F401

    all_errs = []
    for seed in range(SEED0, SEED0 + N):
        errs, _ = await run_scenario(hass, freezer, seed)
        all_errs += errs
    summary = (
        f"scenarios={N} imports={sum(PATHS.values())} paths={dict(PATHS.most_common())} failures={len(all_errs)}\n"
    )
    if OUT:
        with open(OUT, "w") as f:
            f.write(summary)
            f.writelines(e + "\n" for e in all_errs)
    print(summary)
    assert not all_errs, summary + "\n".join(all_errs[:40])

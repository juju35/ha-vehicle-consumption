"""The first recorded state of a source after its hourly statistics, when the car was parked across a month end.

An odometer that only reports at the end of a trip has no recorded state while the car is parked: its first recorded
state can come days after its last hourly statistic. What it counts is the trip that just ended, not something spread
over the days since that hour, so it must land in the month of that state (here November), not be shared out with
October.
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
ODO, FUEL = "sensor.s_odo", "sensor.s_fuel"


def _row(when, entity_id, value):
    return (when, entity_id, State(entity_id, str(value), KM if entity_id == ODO else LITERS, last_updated=when))


@pytest.mark.parametrize("tz", ["Europe/Paris", "UTC"])
async def test_parked_across_month_end(hass: HomeAssistant, tz: str) -> None:
    await hass.config.async_set_time_zone(tz)
    zone = ZoneInfo(tz)

    def local(*a):
        return datetime(*a, tzinfo=zone).astimezone(UTC)

    now = local(2026, 11, 10, 12)
    # Hourly statistics until 30 Oct 12:00: a 40 km / 2.4 L drive on 28 Oct, then parked.
    hourly = []
    hour = local(2026, 10, 20)
    while hour < local(2026, 10, 30, 12):
        end = hour + timedelta(hours=1)
        driven = end > local(2026, 10, 28, 9)
        hourly += [_row(end, ODO, 5040 if driven else 5000), _row(end, FUEL, 37.6 if driven else 40)]
        hour = end
    # Recorded states from 30 Oct 12:00 (purge): the fuel level has one, the odometer none until the car moves again,
    # a 50 km / 3 L drive reported at its end on 3 Nov 10:30.
    states = [
        _row(local(2026, 10, 30, 12), FUEL, 37.6),
        _row(local(2026, 11, 3, 10, 30), ODO, 5090),
        _row(local(2026, 11, 3, 10, 30), FUEL, 34.6),
    ]
    hass.states.async_set(ODO, "5090", KM)
    hass.states.async_set(FUEL, "34.6", LITERS)
    tracker = T.ConsumptionTracker(hass, "s", "S", {CONF_ODOMETER: ODO, CONF_FUEL_QUANTITY: FUEL})
    tracker._changed = lambda: None
    tracker._replay([*hourly, *states], set(), now, hourly_until=hourly[-1][0])

    months = {k: (round(v.distance, 1), round(v.fuel, 2)) for k, v in tracker.months.items()}
    assert months["2026-11"] == (50.0, 3.0), months
    assert months["2026-10"] == (40.0, 2.4), months
    assert round(tracker.total.distance, 1) == 90.0
    november = [t for t in tracker.trips if dt_util.as_local(t.start).month == 11]
    assert [round(t.totals.distance, 1) for t in november] == [50.0]

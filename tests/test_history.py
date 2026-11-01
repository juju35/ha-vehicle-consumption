"""History import: trips, refuels and months rebuilt from what the recorder kept of the sensors."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

import pytest
from freezegun.api import FrozenDateTimeFactory
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ServiceValidationError
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.components.recorder.common import async_wait_recording_done

from custom_components.vehicle_consumption.const import (
    CONF_FUEL_LEVEL,
    CONF_FUEL_PRICE,
    CONF_FUEL_PRICE_ENTITY,
    CONF_FUEL_QUANTITY,
    CONF_ODOMETER,
    CONF_TANK_CAPACITY,
    DOMAIN,
    SERVICE_ADD_REFUEL,
    SERVICE_IMPORT_HISTORY,
)
from custom_components.vehicle_consumption.tracker import HISTORY_IMPORT_VERSION

from .conftest import (
    FUEL,
    FUEL_LEVEL,
    FUEL_PRICE,
    KM,
    LITERS,
    ODOMETER,
    PERCENT,
    entity_id,
    setup_vehicle,
    state_of,
)

PRICE = {"unit_of_measurement": "€/L"}
START = datetime(2026, 10, 20, 7, 0, tzinfo=dt_util.UTC)

# A morning trip, a midday trip ended by a refuel, an evening trip (minutes after START: odometer km, fuel L).
# The car reports the odometer and the fuel in the same poll, the odometer first.
JOURNEY = [
    (0, 1000, 40),
    (30, 1020, 38),  # trip 1: 20 km, 2 L
    (180, 1050, 36),  # trip 2: 30 km, 2 L
    (210, 1050, 49),  # refuel: +13 L
    (300, 1100, 46),  # trip 3: 50 km, 3 L
]


async def _record(hass: HomeAssistant, freezer: FrozenDateTimeFactory, rows: list[tuple[int, float, float]]) -> None:
    for minutes, km, liters in rows:
        freezer.move_to(START + timedelta(minutes=minutes))
        hass.states.async_set(ODOMETER, str(km), KM)
        freezer.tick(timedelta(seconds=1))
        hass.states.async_set(FUEL, str(liters), LITERS)
        await hass.async_block_till_done()
    await async_wait_recording_done(hass)


def _attrs(hass: HomeAssistant) -> dict[str, Any]:
    return state_of(hass, "consumption").attributes


async def _setup(hass: HomeAssistant, freezer: FrozenDateTimeFactory, **options: Any):
    freezer.move_to(START + timedelta(hours=6))
    entry = await setup_vehicle(hass, {CONF_ODOMETER: ODOMETER, CONF_FUEL_QUANTITY: FUEL, **options}, states={})
    # The first import runs in the background.
    await hass.async_block_till_done(wait_background_tasks=True)
    return entry


async def test_first_start_imports_history(recorder_mock, hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> None:
    """Set up after the drives: the trips, the refuel and the month come from the recorded states."""
    await _record(hass, freezer, JOURNEY)
    await _setup(hass, freezer, **{CONF_FUEL_PRICE: 2.0})

    attrs = _attrs(hass)
    assert [(t["distance"], t["fuel"]) for t in attrs["trips"]] == [(50, 3), (30, 2), (20, 2)]
    assert attrs["trips"][-1]["start"] == (START + timedelta(minutes=30)).isoformat()
    [refuel] = attrs["refuels"]
    assert refuel["liters"] == 13 and refuel["cost"] == 26 and refuel["odometer"] == 1050
    assert refuel["time"] == (START + timedelta(minutes=210, seconds=1)).isoformat()
    total = attrs["total"]
    assert total["distance"] == 100 and total["fuel"] == 7 and total["fuel_consumption"] == 7.0
    assert total["since"] == START.isoformat()
    assert attrs["month"]["month"] == "2026-10" and attrs["month"]["cost"] == 14
    assert state_of(hass, "consumption").state == "7.0"


async def test_import_only_once(recorder_mock, hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> None:
    """A reload does not import again: what was tracked since stays."""
    await _record(hass, freezer, JOURNEY)
    entry = await _setup(hass, freezer)
    hass.states.async_set(ODOMETER, "1110", KM)
    await hass.async_block_till_done()
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done(wait_background_tasks=True)
    assert _attrs(hass)["total"]["distance"] == 110


async def test_import_action_keeps_manual_events(
    recorder_mock, hass: HomeAssistant, freezer: FrozenDateTimeFactory
) -> None:
    """The action rebuilds from the history again; refuels logged by hand stay."""
    await _record(hass, freezer, JOURNEY[:2])
    entry = await _setup(hass, freezer)
    await hass.services.async_call(
        DOMAIN, SERVICE_ADD_REFUEL, {"config_entry_id": entry.entry_id, "liters": 30, "cost": 55}, blocking=True
    )
    await _record(hass, freezer, [(400, 1080, 34)])
    freezer.move_to(START + timedelta(hours=8))
    await hass.services.async_call(DOMAIN, SERVICE_IMPORT_HISTORY, {"config_entry_id": entry.entry_id}, blocking=True)

    attrs = _attrs(hass)
    assert attrs["total"]["distance"] == 80 and attrs["total"]["fuel"] == 6
    assert [t["distance"] for t in attrs["trips"]] == [60, 20]
    assert [(r["liters"], r["source"]) for r in attrs["refuels"]] == [(30, "manual")]


async def test_prices_of_then(recorder_mock, hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> None:
    """With a price sensor, the fuel used before a price change costs the old price."""
    freezer.move_to(START - timedelta(minutes=5))
    hass.states.async_set(FUEL_PRICE, "2.0", PRICE)
    await _record(hass, freezer, JOURNEY[:2])
    freezer.move_to(START + timedelta(minutes=60))
    hass.states.async_set(FUEL_PRICE, "1.5", PRICE)
    await _record(hass, freezer, JOURNEY[2:3])
    await _setup(hass, freezer, **{CONF_FUEL_PRICE_ENTITY: FUEL_PRICE})
    assert _attrs(hass)["total"]["cost"] == 2 * 2.0 + 2 * 1.5


async def test_import_without_recorder(hass: HomeAssistant) -> None:
    """No recorder: the vehicle is tracked from now on, and the action says why it cannot import."""
    entry = await setup_vehicle(hass)
    assert entity_id(hass, "consumption")
    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(
            DOMAIN, SERVICE_IMPORT_HISTORY, {"config_entry_id": entry.entry_id}, blocking=True
        )


def _metadata(statistic_id: str, unit: str, *, mean: bool = False) -> dict[str, Any]:
    """Statistic metadata for a sensor, with the fields of the running Home Assistant version.

    Total and total-increasing sensors (an odometer, a tank) have sums and keep their `state`; measurement sensors
    (a level in %, a price) only have a mean, a min and a max (`mean`).
    """
    from homeassistant.components.recorder.models import StatisticMetaData

    metadata: dict[str, Any] = {
        "has_mean": mean,
        "has_sum": not mean,
        "name": None,
        "source": "recorder",
        "statistic_id": statistic_id,
        "unit_of_measurement": unit,
    }
    fields = getattr(StatisticMetaData, "__annotations__", {})
    if "mean_type" in fields:
        from homeassistant.components.recorder.models import StatisticMeanType

        metadata["mean_type"] = StatisticMeanType.ARITHMETIC if mean else StatisticMeanType.NONE
    if "unit_class" in fields:
        metadata["unit_class"] = None
    return metadata


async def test_hourly_statistics_before_the_states(
    recorder_mock, hass: HomeAssistant, freezer: FrozenDateTimeFactory
) -> None:
    """Before the recorded states, the hourly statistics stand in: a drive over two hours is one trip."""
    from homeassistant.components.recorder.statistics import async_import_statistics

    # Five days before the recorded states: (odometer km, fuel L) at the end of each hour from 08:00.
    hours = [(900, 50), (930, 48), (960, 46), (960, 52), (1000, 40)]
    first = START - timedelta(days=5)
    for statistic_id, unit, index in ((ODOMETER, "km", 0), (FUEL, "L", 1)):
        async_import_statistics(
            hass,
            _metadata(statistic_id, unit),
            [
                {"start": first + timedelta(hours=h), "state": row[index], "sum": row[index]}
                for h, row in enumerate(hours)
            ],
        )
    await _record(hass, freezer, JOURNEY)
    await _setup(hass, freezer, **{CONF_FUEL_PRICE: 2.0})

    attrs = _attrs(hass)
    # 60 km over two hours, then 40 km, then the three trips of the recorded states.
    assert [(t["distance"], t["fuel"]) for t in attrs["trips"]] == [(50, 3), (30, 2), (20, 2), (40, 12), (60, 4)]
    assert attrs["trips"][-1]["start"] == (first + timedelta(hours=2)).isoformat()
    assert [r["liters"] for r in attrs["refuels"]] == [13, 6]
    assert attrs["total"]["distance"] == 200 and attrs["total"]["since"] == (first + timedelta(hours=1)).isoformat()


async def test_days_limit(recorder_mock, hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> None:
    """The action only goes back the number of days asked: what it does not cover is kept, not wiped."""
    await _record(hass, freezer, [(-3 * 24 * 60, 900, 50), *JOURNEY])
    entry = await _setup(hass, freezer)
    assert _attrs(hass)["total"]["distance"] == 200
    await hass.services.async_call(
        DOMAIN, SERVICE_IMPORT_HISTORY, {"config_entry_id": entry.entry_id, "days": 1}, blocking=True
    )
    # One day of October recorded: the month (and the 100 km driven three days before) stays as it was.
    assert _attrs(hass)["total"]["distance"] == 200
    assert [(m["month"], m["distance"]) for m in _attrs(hass)["months"]] == [("2026-10", 200)]


def _import_hourly(hass: HomeAssistant, statistic_id: str, unit: str, first: datetime, values: list[float]) -> None:
    """Hourly statistics of a measurement sensor (mean, min and max only, no state), from `first`."""
    from homeassistant.components.recorder.statistics import async_import_statistics

    async_import_statistics(
        hass,
        _metadata(statistic_id, unit, mean=True),
        [{"start": first + timedelta(hours=h), "mean": v, "min": v, "max": v} for h, v in enumerate(values)],
    )


def _import_odometer(hass: HomeAssistant, first: datetime, values: list[float]) -> None:
    from homeassistant.components.recorder.statistics import async_import_statistics

    async_import_statistics(
        hass,
        _metadata(ODOMETER, "km"),
        [{"start": first + timedelta(hours=h), "state": v, "sum": v} for h, v in enumerate(values)],
    )


async def _record_level(hass: HomeAssistant, freezer: FrozenDateTimeFactory, km: float, level: float) -> None:
    freezer.move_to(START)
    hass.states.async_set(ODOMETER, str(km), KM)
    freezer.tick(timedelta(seconds=1))
    hass.states.async_set(FUEL_LEVEL, str(level), PERCENT)
    await hass.async_block_till_done()
    await async_wait_recording_done(hass)


async def _setup_level(hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> None:
    freezer.move_to(START + timedelta(hours=6))
    await setup_vehicle(hass, {CONF_ODOMETER: ODOMETER, CONF_FUEL_LEVEL: FUEL_LEVEL, CONF_TANK_CAPACITY: 50}, states={})
    await hass.async_block_till_done(wait_background_tasks=True)


async def test_hourly_statistics_of_a_level_in_percent(
    recorder_mock, hass: HomeAssistant, freezer: FrozenDateTimeFactory
) -> None:
    """A level in % (a measurement sensor) has no hourly state, only a mean: the mean stands in.

    Without it, the odometer alone was replayed and the hourly trips used 0 L (0.0 L/100 km).
    """
    first = START - timedelta(days=5)
    _import_odometer(hass, first, [900, 950, 1000])
    _import_hourly(hass, FUEL_LEVEL, "%", first, [100, 92, 84])
    await _record_level(hass, freezer, 1000, 84)
    await _setup_level(hass, freezer)

    attrs = _attrs(hass)
    # 50 L tank: 16 % is 8 L over 100 km.
    assert [(t["distance"], t["fuel"]) for t in attrs["trips"]] == [(100, 8)]
    assert attrs["trips"][0]["fuel_consumption"] == 8.0
    assert attrs["total"]["fuel_consumption"] == 8.0


async def test_hourly_statistics_skipped_without_the_level(
    recorder_mock, hass: HomeAssistant, freezer: FrozenDateTimeFactory
) -> None:
    """A level without any statistics (no state class): no hourly replay at all, rather than trips with 0 L."""
    first = START - timedelta(days=5)
    _import_odometer(hass, first, [900, 950, 1000])
    await _record_level(hass, freezer, 1000, 84)
    await _setup_level(hass, freezer)

    attrs = _attrs(hass)
    assert attrs["trips"] == []
    assert attrs["total"]["distance"] == 0 and attrs["total"]["since"] == START.isoformat()


async def test_hourly_statistics_start_with_the_level(
    recorder_mock, hass: HomeAssistant, freezer: FrozenDateTimeFactory
) -> None:
    """The level's statistics begin later than the odometer's: the hours before (no fuel known) are skipped."""
    first = START - timedelta(days=5)
    _import_odometer(hass, first, [800, 900, 950, 1000])
    _import_hourly(hass, FUEL_LEVEL, "%", first + timedelta(hours=1), [100, 92, 84])
    await _record_level(hass, freezer, 1000, 84)
    await _setup_level(hass, freezer)

    attrs = _attrs(hass)
    assert [(t["distance"], t["fuel"]) for t in attrs["trips"]] == [(100, 8)]
    assert attrs["total"]["distance"] == 100


async def test_stable_price_before_the_window(
    recorder_mock, hass: HomeAssistant, freezer: FrozenDateTimeFactory
) -> None:
    """A price sensor that did not change during the imported days still prices the trips and the refuel."""
    freezer.move_to(START - timedelta(days=90))
    hass.states.async_set(FUEL_PRICE, "2.0", PRICE)
    await hass.async_block_till_done()
    await _record(hass, freezer, JOURNEY)
    await _setup(hass, freezer, **{CONF_FUEL_PRICE_ENTITY: FUEL_PRICE})

    attrs = _attrs(hass)
    assert attrs["total"]["cost"] == 14
    assert [r["cost"] for r in attrs["refuels"]] == [26]


async def test_price_known_only_later_in_the_window(
    recorder_mock, hass: HomeAssistant, freezer: FrozenDateTimeFactory
) -> None:
    """No price before the window: the first price known in it stands in for the start, then each change applies."""
    await _record(hass, freezer, JOURNEY[:2])
    freezer.move_to(START + timedelta(minutes=60))
    hass.states.async_set(FUEL_PRICE, "1.5", PRICE)
    await _record(hass, freezer, JOURNEY[2:3])
    freezer.move_to(START + timedelta(minutes=120))
    hass.states.async_set(FUEL_PRICE, "1.0", PRICE)
    await hass.async_block_till_done()
    await _setup(hass, freezer, **{CONF_FUEL_PRICE_ENTITY: FUEL_PRICE})
    # Trip 1 (2 L) before any price: the first known price, 1.5; trip 2 (2 L) at 1.0.
    assert _attrs(hass)["total"]["cost"] == 2 * 1.5 + 2 * 1.0


async def test_hourly_price_means(recorder_mock, hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> None:
    """A price sensor (a measurement) has an hourly mean too: the hourly trips cost the price of then."""
    from homeassistant.components.recorder.statistics import async_import_statistics

    hours = [(900, 50), (930, 48), (960, 46), (960, 52), (1000, 40)]
    first = START - timedelta(days=5)
    for statistic_id, unit, index in ((ODOMETER, "km", 0), (FUEL, "L", 1)):
        async_import_statistics(
            hass,
            _metadata(statistic_id, unit),
            [
                {"start": first + timedelta(hours=h), "state": row[index], "sum": row[index]}
                for h, row in enumerate(hours)
            ],
        )
    _import_hourly(hass, FUEL_PRICE, "€/L", first, [2.0] * len(hours))
    freezer.move_to(START - timedelta(minutes=5))
    hass.states.async_set(FUEL_PRICE, "1.0", PRICE)
    await _record(hass, freezer, JOURNEY)
    await _setup(hass, freezer, **{CONF_FUEL_PRICE_ENTITY: FUEL_PRICE})

    attrs = _attrs(hass)
    # 16 L over the hours at 2.0, then the 7 L of the recorded states at 1.0.
    assert attrs["total"]["fuel"] == 23 and attrs["total"]["cost"] == 16 * 2.0 + 7 * 1.0
    assert [r["cost"] for r in attrs["refuels"]] == [13 * 1.0, 6 * 2.0]


async def _record_levels(hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> None:
    """The fuel level (%) of JOURNEY from a distinct sensor, 50 L tank: 2 % a litre, reported after the quantity."""
    for minutes, _, liters in JOURNEY:
        freezer.move_to(START + timedelta(minutes=minutes, seconds=2))
        hass.states.async_set(FUEL_LEVEL, str(2 * liters), PERCENT)
        await hass.async_block_till_done()
    await async_wait_recording_done(hass)


async def test_level_next_to_quantity_is_not_replayed(
    recorder_mock, hass: HomeAssistant, freezer: FrozenDateTimeFactory
) -> None:
    """A fuel level sensor next to the quantity is shown, not replayed: no fake refuels from it."""
    await _record(hass, freezer, JOURNEY)
    await _record_levels(hass, freezer)
    await _setup(hass, freezer, **{CONF_FUEL_LEVEL: FUEL_LEVEL, CONF_TANK_CAPACITY: 50})
    attrs = _attrs(hass)
    assert [r["liters"] for r in attrs["refuels"]] == [13]
    assert attrs["total"]["fuel"] == 7
    assert [(t["distance"], t["fuel"]) for t in attrs["trips"]] == [(50, 3), (30, 2), (20, 2)]
    assert attrs["fuel_level"] == 92 and attrs["fuel_quantity"] == 46


async def test_same_sensor_as_quantity_and_level(
    recorder_mock, hass: HomeAssistant, freezer: FrozenDateTimeFactory
) -> None:
    """One sensor stored as both the quantity and the level (allowed before 0.2.2) is a quantity only."""
    await _record(hass, freezer, JOURNEY)
    await _setup(hass, freezer, **{CONF_FUEL_LEVEL: FUEL})
    attrs = _attrs(hass)
    assert [r["liters"] for r in attrs["refuels"]] == [13]
    assert attrs["total"]["fuel"] == 7
    assert attrs["fuel_level"] is None  # 46 L is not 46 %, and there is no tank capacity


async def test_hourly_statistics_without_a_level_next_to_quantity(
    recorder_mock, hass: HomeAssistant, freezer: FrozenDateTimeFactory
) -> None:
    """A level next to the quantity is not replayed: its missing statistics do not cancel the hourly replay."""
    from homeassistant.components.recorder.statistics import async_import_statistics

    hours = [(900, 50), (930, 48), (960, 46), (960, 52), (1000, 40)]
    first = START - timedelta(days=5)
    for statistic_id, unit, index in ((ODOMETER, "km", 0), (FUEL, "L", 1)):
        async_import_statistics(
            hass,
            _metadata(statistic_id, unit),
            [
                {"start": first + timedelta(hours=h), "state": row[index], "sum": row[index]}
                for h, row in enumerate(hours)
            ],
        )
    await _record(hass, freezer, JOURNEY)
    await _record_levels(hass, freezer)
    await _setup(hass, freezer, **{CONF_FUEL_LEVEL: FUEL_LEVEL, CONF_TANK_CAPACITY: 50})

    attrs = _attrs(hass)
    assert [(t["distance"], t["fuel"]) for t in attrs["trips"]] == [(50, 3), (30, 2), (20, 2), (40, 12), (60, 4)]
    assert [r["liters"] for r in attrs["refuels"]] == [13, 6]
    assert attrs["total"]["distance"] == 200


async def test_old_import_done_again(
    recorder_mock, hass: HomeAssistant, freezer: FrozenDateTimeFactory, hass_storage: dict[str, Any]
) -> None:
    """A history imported before 0.2.2 (stored as `true`) is imported again once, manual refuels kept."""
    await _record(hass, freezer, JOURNEY)
    entry = await _setup(hass, freezer)
    await hass.services.async_call(
        DOMAIN, SERVICE_ADD_REFUEL, {"config_entry_id": entry.entry_id, "liters": 30, "cost": 55}, blocking=True
    )
    await hass.config_entries.async_unload(entry.entry_id)
    key = f"{DOMAIN}.{entry.entry_id}"
    hass_storage[key]["data"].update(history_imported=True, total={"distance": 5})
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done(wait_background_tasks=True)
    attrs = _attrs(hass)
    assert attrs["total"]["distance"] == 100
    assert sorted((r["liters"], r["source"]) for r in attrs["refuels"]) == [(13, "auto"), (30, "manual")]


async def test_current_import_not_done_again(
    recorder_mock, hass: HomeAssistant, freezer: FrozenDateTimeFactory, hass_storage: dict[str, Any]
) -> None:
    """An import of this version is stored as such: a restart does not replay it again."""
    await _record(hass, freezer, JOURNEY)
    entry = await _setup(hass, freezer)
    await hass.config_entries.async_unload(entry.entry_id)
    key = f"{DOMAIN}.{entry.entry_id}"
    assert hass_storage[key]["data"]["history_imported"] == HISTORY_IMPORT_VERSION
    hass_storage[key]["data"].update(total={"distance": 5})
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done(wait_background_tasks=True)
    assert _attrs(hass)["total"]["distance"] == 5


async def _store_old_import(hass: HomeAssistant, hass_storage: dict[str, Any], entry, **data: Any) -> dict[str, Any]:
    """Unload the vehicle and make its store look like a 0.2.0 / 0.2.1 import (`history_imported: true`)."""
    await hass.config_entries.async_unload(entry.entry_id)
    stored = hass_storage[f"{DOMAIN}.{entry.entry_id}"]["data"]
    stored.update(history_imported=True, **data)
    return stored


async def test_old_import_with_an_empty_recorder_keeps_the_data(
    recorder_mock, hass: HomeAssistant, freezer: FrozenDateTimeFactory, hass_storage: dict[str, Any]
) -> None:
    """Imported again with nothing recorded for the sensors (excluded from the recorder): nothing is wiped."""
    entry = await _setup(hass, freezer)
    trip = {"start": "2026-09-12T08:00:00+00:00", "end": "2026-09-12T09:00:00+00:00", "distance": 80, "fuel": 5}
    await _store_old_import(
        hass,
        hass_storage,
        entry,
        since="2026-08-01T00:00:00+00:00",
        total={"distance": 5000, "fuel": 300},
        months={"2026-08": {"distance": 3000, "fuel": 180}, "2026-09": {"distance": 2000, "fuel": 120}},
        trips=[trip],
    )
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done(wait_background_tasks=True)

    attrs = _attrs(hass)
    assert attrs["total"]["distance"] == 5000 and attrs["total"]["fuel"] == 300
    assert attrs["total"]["since"] == "2026-08-01T00:00:00+00:00"
    assert [(m["month"], m["distance"]) for m in attrs["months"]] == [("2026-08", 3000), ("2026-09", 2000), ("2026-10", 0)]
    assert [t["distance"] for t in attrs["trips"]] == [80]
    # Marked as imported: not tried again at the next start.
    await hass.config_entries.async_unload(entry.entry_id)
    assert hass_storage[f"{DOMAIN}.{entry.entry_id}"]["data"]["history_imported"] == HISTORY_IMPORT_VERSION


async def test_import_keeps_the_months_before_the_recorded_ones(
    recorder_mock, hass: HomeAssistant, freezer: FrozenDateTimeFactory, hass_storage: dict[str, Any]
) -> None:
    """Imported again from a recorder that starts after the tracking did: the months it does not fully cover stay.

    The recorded states start on 20 October: August, September and October stay as tracked, November (fully
    recorded) is rebuilt, and the total adds them up.
    """
    await _record(hass, freezer, JOURNEY)
    entry = await _setup(hass, freezer)
    old_trip = {"start": "2026-08-12T08:00:00+00:00", "end": "2026-08-12T09:00:00+00:00", "distance": 70, "fuel": 4}
    stored = await _store_old_import(
        hass,
        hass_storage,
        entry,
        since="2026-08-01T00:00:00+00:00",
        total={"distance": 3040, "fuel": 183},
        months={
            "2026-08": {"distance": 1000, "fuel": 60},
            "2026-09": {"distance": 2000, "fuel": 120},
            "2026-10": {"distance": 40, "fuel": 3},
        },
    )
    stored["trips"].append(old_trip)
    # 2 November (local time): one drive of 80 km, 5 L, while the integration was not loaded.
    await _record(hass, freezer, [(19200, 1150, 43), (19220, 1180, 41)])
    freezer.move_to(START + timedelta(days=13, hours=12))
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done(wait_background_tasks=True)

    attrs = _attrs(hass)
    assert [(m["month"], m["distance"], m["fuel"]) for m in attrs["months"]] == [
        ("2026-08", 1000, 60),
        ("2026-09", 2000, 120),
        ("2026-10", 40, 3),
        ("2026-11", 80, 5),
    ]
    assert attrs["total"]["distance"] == 3120 and attrs["total"]["fuel"] == 188
    assert attrs["total"]["since"] == "2026-08-01T00:00:00+00:00"
    assert [t["distance"] for t in attrs["trips"]] == [80, 50, 30, 20, 70]
    assert [r["liters"] for r in attrs["refuels"]] == [13]
    assert attrs["odometer"] == 1180 and attrs["fuel_quantity"] == 41


async def test_import_with_only_the_price_recorded_keeps_the_data(
    recorder_mock, hass: HomeAssistant, freezer: FrozenDateTimeFactory
) -> None:
    """The action, with a price sensor recorded but not the vehicle's sensors: the tracked figures stay."""
    freezer.move_to(START)
    hass.states.async_set(FUEL_PRICE, "2.0", PRICE)
    await hass.async_block_till_done()
    await async_wait_recording_done(hass)
    entry = await _setup(hass, freezer, **{CONF_FUEL_PRICE_ENTITY: FUEL_PRICE})
    # Tracked live, sensors excluded from the recorder (not recorded here: set after the recorder was paused).
    tracker = entry.runtime_data
    tracker.total.distance = 640
    tracker.months["2026-10"] = tracker.total.copy()
    await hass.services.async_call(DOMAIN, SERVICE_IMPORT_HISTORY, {"config_entry_id": entry.entry_id}, blocking=True)
    attrs = _attrs(hass)
    assert attrs["total"]["distance"] == 640
    assert [(m["month"], m["distance"]) for m in attrs["months"]] == [("2026-10", 640)]

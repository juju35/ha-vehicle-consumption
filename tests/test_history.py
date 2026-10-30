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
    DOMAIN,
    SERVICE_ADD_REFUEL,
    SERVICE_IMPORT_HISTORY,
)

from .conftest import FUEL, FUEL_PRICE, KM, LITERS, ODOMETER, entity_id, setup_vehicle, state_of

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


def _metadata(statistic_id: str, unit: str) -> dict[str, Any]:
    """Statistic metadata for a sensor, with the fields of the running Home Assistant version."""
    from homeassistant.components.recorder.models import StatisticMetaData

    metadata: dict[str, Any] = {
        "has_mean": False,
        # Total and total-increasing sensors (an odometer, a tank) have sums: only those keep their `state`.
        "has_sum": True,
        "name": None,
        "source": "recorder",
        "statistic_id": statistic_id,
        "unit_of_measurement": unit,
    }
    fields = getattr(StatisticMetaData, "__annotations__", {})
    if "mean_type" in fields:
        from homeassistant.components.recorder.models import StatisticMeanType

        metadata["mean_type"] = StatisticMeanType.NONE
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
    """The action only goes back the number of days asked."""
    await _record(hass, freezer, [(-3 * 24 * 60, 900, 50), *JOURNEY])
    entry = await _setup(hass, freezer)
    assert _attrs(hass)["total"]["distance"] == 200
    await hass.services.async_call(
        DOMAIN, SERVICE_IMPORT_HISTORY, {"config_entry_id": entry.entry_id, "days": 1}, blocking=True
    )
    assert _attrs(hass)["total"]["distance"] == 100


async def test_level_next_to_quantity_is_not_replayed(
    recorder_mock, hass: HomeAssistant, freezer: FrozenDateTimeFactory
) -> None:
    """A fuel level set next to the quantity (even the same sensor) adds nothing: no fake refuels from it."""
    await _record(hass, freezer, JOURNEY)
    await _setup(hass, freezer, **{CONF_FUEL_LEVEL: FUEL})
    attrs = _attrs(hass)
    assert [r["liters"] for r in attrs["refuels"]] == [13]
    assert attrs["total"]["fuel"] == 7
    assert attrs["fuel_level"] is None  # 46 L is not 46 %, and there is no tank capacity


async def test_price_before_its_first_state(recorder_mock, hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> None:
    """Fuel used before the price sensor's first recorded state costs that first price."""
    await _record(hass, freezer, JOURNEY[:2])
    freezer.move_to(START + timedelta(minutes=60))
    hass.states.async_set(FUEL_PRICE, "1.5", PRICE)
    await _record(hass, freezer, JOURNEY[2:3])
    await _setup(hass, freezer, **{CONF_FUEL_PRICE_ENTITY: FUEL_PRICE})
    assert _attrs(hass)["total"]["cost"] == 4 * 1.5


async def test_old_import_done_again(
    recorder_mock, hass: HomeAssistant, freezer: FrozenDateTimeFactory, hass_storage: dict[str, Any]
) -> None:
    """A history imported before 0.2.1 (stored as `true`) is imported again once."""
    await _record(hass, freezer, JOURNEY)
    entry = await _setup(hass, freezer)
    assert _attrs(hass)["total"]["distance"] == 100
    await hass.config_entries.async_unload(entry.entry_id)
    key = f"{DOMAIN}.{entry.entry_id}"
    hass_storage[key]["data"].update(history_imported=True, total={"distance": 5})
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done(wait_background_tasks=True)
    assert _attrs(hass)["total"]["distance"] == 100

"""Lease mileage allowance: the contract maths, the options step, the sensors and the card attribute."""

from __future__ import annotations

from datetime import date

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.util.unit_system import US_CUSTOMARY_SYSTEM

from custom_components.vehicle_consumption.const import (
    CONF_CHARGE_THRESHOLD,
    CONF_FUEL_QUANTITY,
    CONF_LEASE_DISTANCE,
    CONF_LEASE_EXTRA_PRICE,
    CONF_LEASE_MONTHS,
    CONF_LEASE_START,
    CONF_LEASE_START_ODOMETER,
    CONF_ODOMETER,
    CONF_REFUEL_THRESHOLD,
    CONF_TRIP_GAP,
    CONF_UNITS,
)
from custom_components.vehicle_consumption.lease import Lease, _add_months

from .conftest import FUEL, KM, LITERS, ODOMETER, entity_id, setup_vehicle, state_of

TUNING = {CONF_TRIP_GAP: 30, CONF_REFUEL_THRESHOLD: 3, CONF_CHARGE_THRESHOLD: 1}
LEASE = {
    CONF_LEASE_START: "2025-01-15",
    CONF_LEASE_MONTHS: 36,
    CONF_LEASE_DISTANCE: 40000,
    CONF_LEASE_START_ODOMETER: 10,
    CONF_LEASE_EXTRA_PRICE: 0.06,
}


def test_add_months_clamps_the_day() -> None:
    assert _add_months(date(2025, 1, 31), 1) == date(2025, 2, 28)
    assert _add_months(date(2024, 1, 31), 1) == date(2024, 2, 29)
    assert _add_months(date(2025, 11, 15), 3) == date(2026, 2, 15)
    assert _add_months(date(2025, 1, 15), 36) == date(2028, 1, 15)


def test_from_options_needs_start_length_and_allowance() -> None:
    assert Lease.from_options({}) is None
    assert Lease.from_options({CONF_LEASE_START: "2025-01-15", CONF_LEASE_MONTHS: 36}) is None
    assert Lease.from_options({**LEASE, CONF_LEASE_START: "not a date"}) is None
    lease = Lease.from_options(LEASE)
    assert lease == Lease(date(2025, 1, 15), 36, 40000.0, 10.0, 0.06)
    assert lease.end == date(2028, 1, 15)
    # A price of 0 is no price; no odometer at delivery: 0.
    lease = Lease.from_options({**LEASE, CONF_LEASE_EXTRA_PRICE: 0, CONF_LEASE_START_ODOMETER: None})
    assert lease.extra_price is None and lease.start_odometer == 0.0


def test_status_halfway_ahead_of_the_allowance() -> None:
    lease = Lease(date(2025, 1, 1), 24, 30000.0)
    # Last three complete months at 1500 km: the pace, not the average since the start.
    months = [{"month": f"2025-{m:02d}", "distance": 1000.0} for m in range(1, 10)] + [
        {"month": f"2025-{m:02d}", "distance": 1500.0} for m in range(10, 13)
    ]
    status = lease.status(16000.0, [*months, {"month": "2026-01", "distance": 200.0}], date(2026, 1, 1))
    assert status["month"] == 13 and status["months"] == 24 and not status["ended"]
    assert status["prorata"] == 15000 and status["balance"] == 1000
    assert status["remaining"] == 14000
    assert status["pace"] == 1500
    # 365 of 730 days left, 12 months: 16000 + 1500 × 12.
    assert status["projected"] == pytest.approx(34000, abs=20)
    assert status["overage"] == pytest.approx(4000, abs=20)
    assert status["per_month_left"] == pytest.approx(1167, abs=2)
    assert status["overage_cost"] is None


def test_status_pace_falls_back_to_the_average_and_counts_the_cost() -> None:
    lease = Lease(date(2025, 1, 15), 36, 40000.0, start_odometer=10.0, extra_price=0.06)
    # Two complete months only: the average since the start (23400 km over ~20 months).
    status = lease.status(23410.0, [{"month": "2026-07", "distance": 900.0}], date(2026, 9, 15))
    assert status["driven"] == 23400
    assert status["pace"] == pytest.approx(1170, abs=5)
    assert status["overage"] > 0
    assert status["overage_cost"] == pytest.approx(status["overage"] * 0.06, abs=0.1)


def test_status_before_the_start_and_after_the_end() -> None:
    lease = Lease(date(2025, 1, 1), 12, 10000.0)
    before = lease.status(0.0, [], date(2024, 12, 1))
    assert before["month"] == 0 and before["prorata"] == 0 and before["balance"] == 0
    after = lease.status(12500.0, [], date(2026, 3, 1))
    assert after["ended"] and after["month"] == 12
    assert after["projected"] == 12500 and after["overage"] == 2500 and after["remaining"] == -2500
    assert after["per_month_left"] is None
    # No odometer yet: nothing driven, nothing projected.
    unknown = lease.status(None, [], date(2025, 6, 1))
    assert unknown["driven"] is None and unknown["balance"] is None and unknown["projected"] is None


async def test_lease_sensors_and_attribute(hass: HomeAssistant, freezer) -> None:
    freezer.move_to("2026-09-15 12:00:00+00:00")
    await setup_vehicle(
        hass,
        {CONF_ODOMETER: ODOMETER, CONF_FUEL_QUANTITY: FUEL, **LEASE},
        states={ODOMETER: ("23410", KM), FUEL: ("40", LITERS)},
    )
    lease = state_of(hass, "consumption").attributes["lease"]
    assert lease["driven"] == 23400 and lease["allowance"] == 40000 and lease["months"] == 36
    assert float(state_of(hass, "lease_remaining").state) == 16600
    assert float(state_of(hass, "lease_balance").state) == lease["balance"]
    assert float(state_of(hass, "lease_projected").state) == lease["projected"]
    assert state_of(hass, "lease_overage_cost").attributes["unit_of_measurement"] == hass.config.currency


async def test_no_lease_no_sensors(hass: HomeAssistant) -> None:
    await setup_vehicle(hass)
    assert state_of(hass, "consumption").attributes["lease"] is None
    assert entity_id(hass, "lease_remaining") is None


async def test_lease_attribute_in_miles(hass: HomeAssistant, freezer) -> None:
    freezer.move_to("2026-09-15 12:00:00+00:00")
    await setup_vehicle(
        hass,
        {CONF_ODOMETER: ODOMETER, CONF_FUEL_QUANTITY: FUEL, CONF_UNITS: "imperial", **LEASE},
        states={ODOMETER: ("23410", KM), FUEL: ("40", LITERS)},
    )
    lease = state_of(hass, "consumption").attributes["lease"]
    assert lease["allowance"] == round(40000 / 1.609344)
    assert lease["extra_price"] == pytest.approx(0.06 * 1.609344, abs=1e-4)
    # The sensors stay in km (shown in mi by Home Assistant).
    assert state_of(hass, "lease_remaining").attributes["unit_of_measurement"] == "mi"


async def _to_lease_step(hass: HomeAssistant, entry) -> dict:
    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {CONF_ODOMETER: ODOMETER, CONF_FUEL_QUANTITY: FUEL}
    )
    return await hass.config_entries.options.async_configure(result["flow_id"], TUNING)


async def test_options_lease_step(hass: HomeAssistant) -> None:
    entry = await setup_vehicle(hass)
    result = await _to_lease_step(hass, entry)
    assert result["type"] is FlowResultType.FORM and result["step_id"] == "lease"

    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {CONF_LEASE_START: "2025-01-15", CONF_LEASE_MONTHS: 36}
    )
    assert result["errors"] == {"base": "lease_incomplete"}

    result = await hass.config_entries.options.async_configure(result["flow_id"], LEASE)
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert entry.options[CONF_LEASE_MONTHS] == 36 and isinstance(entry.options[CONF_LEASE_MONTHS], int)
    assert entry.options[CONF_LEASE_DISTANCE] == 40000.0
    await hass.async_block_till_done()
    assert entity_id(hass, "lease_remaining") is not None

    # Shown again with the values; emptied, the lease is removed.
    result = await _to_lease_step(hass, entry)
    suggested = {str(k): k.description["suggested_value"] for k in result["data_schema"].schema if k.description}
    assert suggested[CONF_LEASE_START] == "2025-01-15" and suggested[CONF_LEASE_DISTANCE] == 40000.0
    result = await hass.config_entries.options.async_configure(result["flow_id"], {})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert CONF_LEASE_START not in entry.options


async def test_options_lease_step_in_miles(hass: HomeAssistant) -> None:
    hass.config.units = US_CUSTOMARY_SYSTEM
    entry = await setup_vehicle(hass, {CONF_ODOMETER: ODOMETER, CONF_FUEL_QUANTITY: FUEL, CONF_UNITS: "imperial"})
    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {CONF_ODOMETER: ODOMETER, CONF_FUEL_QUANTITY: FUEL}
    )
    result = await hass.config_entries.options.async_configure(result["flow_id"], {CONF_UNITS: "imperial", **TUNING})
    assert result["step_id"] == "lease"
    assert result["data_schema"].schema[CONF_LEASE_DISTANCE].config["unit_of_measurement"] == "mi"
    result = await hass.config_entries.options.async_configure(
        result["flow_id"],
        {
            CONF_LEASE_START: "2025-01-15",
            CONF_LEASE_MONTHS: 36,
            CONF_LEASE_DISTANCE: 25000,
            CONF_LEASE_EXTRA_PRICE: 0.1,
        },
    )
    assert entry.options[CONF_LEASE_DISTANCE] == pytest.approx(25000 * 1.609344)
    assert entry.options[CONF_LEASE_EXTRA_PRICE] == pytest.approx(0.1 / 1.609344)

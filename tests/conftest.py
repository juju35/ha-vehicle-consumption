"""Fixtures for Vehicle Consumption tests."""

from __future__ import annotations

import logging
import os
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers import frame
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.vehicle_consumption.const import (
    CONF_DEVICE_ID,
    CONF_FUEL_QUANTITY,
    CONF_NAME,
    CONF_ODOMETER,
    DOMAIN,
)

ODOMETER = "sensor.car_mileage"
FUEL = "sensor.car_fuel_quantity"
FUEL_LEVEL = "sensor.car_fuel_level"
BATTERY = "sensor.car_battery_energy"
BATTERY_LEVEL = "sensor.car_battery_level"
FUEL_PRICE = "sensor.station_gazole"
ELECTRICITY_PRICE = "sensor.electricity_price"
KM = {"unit_of_measurement": "km", "device_class": "distance", "state_class": "total_increasing"}
LITERS = {"unit_of_measurement": "L", "device_class": "volume_storage"}
KWH = {"unit_of_measurement": "kWh", "device_class": "energy_storage"}
PERCENT = {"unit_of_measurement": "%"}


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(request: pytest.FixtureRequest):
    """Load custom_components/ in every test (after the recorder, for the tests that use it)."""
    if "recorder_mock" in request.fixturenames:
        request.getfixturevalue("recorder_mock")
    request.getfixturevalue("enable_custom_integrations")
    yield


class _DeprecationRecorder(logging.Handler):
    """Collects Home Assistant deprecation reports that name this integration."""

    def __init__(self) -> None:
        super().__init__(logging.WARNING)
        self.messages: list[str] = []

    def emit(self, record: logging.LogRecord) -> None:
        message = record.getMessage()
        lowered = message.lower()
        reported = record.name == frame.__name__ or "deprecated" in lowered or "will stop working" in lowered
        if reported and (f"'{DOMAIN}'" in message or f"custom_components/{DOMAIN}/" in message):
            self.messages.append(message)


@pytest.fixture(autouse=True)
def no_deprecated_calls():
    """Fail a test whose code path makes Home Assistant report a deprecated call of this integration.

    Silent on Home Assistant versions without the deprecation; on newer ones, catches what is left.
    Messages also go to $DEPRECATIONS_LOG (if set), which CI turns into annotations.
    """
    # The frame helper reports each call site once per process: forget them so every test sees its own.
    getattr(frame, "_REPORTED_INTEGRATIONS", set()).clear()
    recorder = _DeprecationRecorder()
    root = logging.getLogger()
    root.addHandler(recorder)
    try:
        yield
    finally:
        root.removeHandler(recorder)
    if recorder.messages and (path := os.environ.get("DEPRECATIONS_LOG")):
        with open(path, "a", encoding="utf-8") as log:
            log.writelines(f"{m}\n" for m in recorder.messages)
    assert not recorder.messages, "\n".join(recorder.messages)


def vehicle_device(hass: HomeAssistant, name: str = "My car", platform: str = "renault") -> str:
    """A vehicle device of `platform`; returns its device ID."""
    # One config entry per platform: since 2026.8 a device belongs to a single config entry.
    entry = next(iter(hass.config_entries.async_entries(platform)), None)
    if entry is None:
        entry = MockConfigEntry(domain=platform)
        entry.add_to_hass(hass)
    return (
        dr.async_get(hass)
        .async_get_or_create(config_entry_id=entry.entry_id, identifiers={(platform, name)}, name=name)
        .id
    )


def add_sensor(
    hass: HomeAssistant,
    device_id: str,
    object_id: str,
    state: str,
    attributes: dict[str, Any],
    *,
    platform: str = "renault",
    unique_id: str | None = None,
    translation_key: str | None = None,
    original_name: str | None = None,
    disabled: bool = False,
) -> str:
    """A registry sensor of the vehicle device, with its state."""
    entry = next(iter(hass.config_entries.async_entries(platform)))
    entity = er.async_get(hass).async_get_or_create(
        "sensor",
        platform,
        unique_id or object_id,
        config_entry=entry,
        device_id=device_id,
        suggested_object_id=object_id,
        translation_key=translation_key,
        original_name=original_name,
        original_device_class=attributes.get("device_class"),
        unit_of_measurement=attributes.get("unit_of_measurement"),
        disabled_by=er.RegistryEntryDisabler.USER if disabled else None,
    )
    if not disabled:
        hass.states.async_set(entity.entity_id, state, attributes)
    return entity.entity_id


async def setup_vehicle(
    hass: HomeAssistant,
    options: dict[str, Any] | None = None,
    *,
    name: str = "My car",
    states: dict[str, tuple[str, dict[str, Any]]] | None = None,
) -> MockConfigEntry:
    """Set up an entry for a fuel car (odometer 10000 km, 40 L) unless `options` / `states` say otherwise."""
    if states is None:
        states = {ODOMETER: ("10000", KM), FUEL: ("40", LITERS)}
    for entity_id, (state, attributes) in states.items():
        hass.states.async_set(entity_id, state, attributes)
    if options is None:
        options = {CONF_ODOMETER: ODOMETER, CONF_FUEL_QUANTITY: FUEL}
    entry = MockConfigEntry(
        domain=DOMAIN,
        title=name,
        unique_id=f"device_{name}",
        data={CONF_DEVICE_ID: f"device_{name}", CONF_NAME: name},
        options=options,
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


def entity_id(hass: HomeAssistant, key: str, name: str = "My car") -> str | None:
    """Entity ID of the sensor `key` of the vehicle `name` (object IDs follow the translated names)."""
    entry = next(e for e in hass.config_entries.async_entries(DOMAIN) if e.title == name)
    return er.async_get(hass).async_get_entity_id("sensor", DOMAIN, f"{entry.entry_id}_{key}")


def state_of(hass: HomeAssistant, key: str, name: str = "My car"):
    """State of the sensor `key` of the vehicle `name` (None when the entity doesn't exist)."""
    eid = entity_id(hass, key, name)
    return hass.states.get(eid) if eid else None

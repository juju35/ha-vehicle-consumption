"""Tests for the setup, unload and removal of an entry, and the card resource."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

import pytest
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.setup import async_setup_component

from custom_components.vehicle_consumption.const import CARD_URL, CONF_FUEL_QUANTITY, CONF_ODOMETER, DOMAIN, VERSION

from .conftest import FUEL, KM, LITERS, ODOMETER, setup_vehicle, state_of


def _resources(hass: HomeAssistant):
    """The Lovelace resources collection: hass.data["lovelace"] is a dict before 2025.2, a dataclass after."""
    lovelace = hass.data["lovelace"]
    return lovelace["resources"] if isinstance(lovelace, dict) else lovelace.resources


def _card_urls(resources) -> list[str]:
    return [i["url"] for i in resources.async_items() if i["url"].split("?")[0] == CARD_URL]


async def test_setup_and_entities(hass: HomeAssistant) -> None:
    entry = await setup_vehicle(hass)
    assert entry.state is ConfigEntryState.LOADED

    entities = er.async_entries_for_config_entry(er.async_get(hass), entry.entry_id)
    assert sorted(e.translation_key for e in entities) == sorted(
        [
            "consumption",
            "fuel_consumption_trip",
            "fuel_consumption_month",
            "fuel_consumption_average",
            "distance_trip",
            "distance_month",
            "fuel_used_month",
            "cost_month",
            "cost_per_km",
            "last_refuel",
        ]
    )
    assert all(e.unique_id == f"{entry.entry_id}_{e.translation_key}" for e in entities)
    # The entry's own device; async_get_device by identifiers is deprecated since 2026.10.
    [device] = dr.async_entries_for_config_entry(dr.async_get(hass), entry.entry_id)
    assert (DOMAIN, entry.entry_id) in device.identifiers
    assert device.name == "My car" and device.manufacturer == "juju35" and device.model == "Vehicle Consumption"
    assert device.entry_type is dr.DeviceEntryType.SERVICE


async def test_unload_saves(hass: HomeAssistant, hass_storage: dict) -> None:
    entry = await setup_vehicle(hass)
    hass.states.async_set(ODOMETER, "10100", KM)
    hass.states.async_set(FUEL, "34", LITERS)
    await hass.async_block_till_done()
    assert await hass.config_entries.async_unload(entry.entry_id)
    stored = hass_storage[f"{DOMAIN}.{entry.entry_id}"]["data"]
    assert stored["total"]["distance"] == 100 and stored["fuel"]["ref"] == 34
    assert state_of(hass, "consumption").state == "unavailable"


async def test_remove_drops_storage(hass: HomeAssistant, hass_storage: dict) -> None:
    entry = await setup_vehicle(hass)
    assert await hass.config_entries.async_unload(entry.entry_id)
    assert f"{DOMAIN}.{entry.entry_id}" in hass_storage
    assert await hass.config_entries.async_remove(entry.entry_id)
    await hass.async_block_till_done()
    assert f"{DOMAIN}.{entry.entry_id}" not in hass_storage


async def test_card_resource_kept_until_last_vehicle_removed(hass: HomeAssistant) -> None:
    """The card resource goes with the last vehicle, and comes back with a new one without a restart."""
    assert await async_setup_component(hass, "lovelace", {})
    resources = _resources(hass)
    first = await setup_vehicle(hass)
    second = await setup_vehicle(
        hass,
        {CONF_ODOMETER: "sensor.van_odometer", CONF_FUEL_QUANTITY: "sensor.van_fuel"},
        name="Van",
        states={"sensor.van_odometer": ("500", KM), "sensor.van_fuel": ("60", LITERS)},
    )
    assert len(_card_urls(resources)) == 1

    assert await hass.config_entries.async_remove(first.entry_id)
    await hass.async_block_till_done()
    assert len(_card_urls(resources)) == 1
    assert await hass.config_entries.async_remove(second.entry_id)
    await hass.async_block_till_done()
    assert _card_urls(resources) == []

    await setup_vehicle(hass)
    assert len(_card_urls(resources)) == 1


async def test_card_resource_updated_and_deduplicated(hass: HomeAssistant) -> None:
    assert await async_setup_component(hass, "lovelace", {})
    resources = _resources(hass)
    await resources.async_get_info()
    await resources.async_create_item({"res_type": "module", "url": f"{CARD_URL}?v=0.0.1"})
    await resources.async_create_item({"res_type": "module", "url": CARD_URL})
    await setup_vehicle(hass)
    [url] = _card_urls(resources)
    assert url.endswith(f"?v={VERSION}")


@pytest.mark.parametrize(
    ("key", "container"),
    [("mode", dict), ("resource_mode", dict), ("mode", SimpleNamespace), ("resource_mode", SimpleNamespace)],
)
async def test_card_resource_with_lovelace_data_variants(hass: HomeAssistant, key: str, container: type) -> None:
    """hass.data["lovelace"]: a dict before 2025.2, then a dataclass with `mode`, renamed `resource_mode` in 2026.2."""
    assert await async_setup_component(hass, "lovelace", {})
    resources = _resources(hass)
    hass.data["lovelace"] = container(**{key: "storage", "resources": resources, "dashboards": {}})
    entry = await setup_vehicle(hass)
    assert len(_card_urls(resources)) == 1
    assert await hass.config_entries.async_remove(entry.entry_id)
    await hass.async_block_till_done()
    assert _card_urls(resources) == []


async def test_card_resource_yaml_mode_untouched(hass: HomeAssistant) -> None:
    """Resources in YAML mode are not edited (the card is loaded on every page instead)."""
    from homeassistant.components.lovelace.resources import ResourceYAMLCollection

    assert await async_setup_component(hass, "lovelace", {})
    hass.data["lovelace"] = {"mode": "yaml", "resources": ResourceYAMLCollection([]), "dashboards": {}}
    with patch("custom_components.vehicle_consumption.add_extra_js_url") as add_js:
        await setup_vehicle(hass)
        await hass.async_block_till_done()
    add_js.assert_called_once()


async def test_card_served(hass: HomeAssistant, hass_client) -> None:
    await setup_vehicle(hass)
    client = await hass_client()
    response = await client.get(CARD_URL)
    assert response.status == 200

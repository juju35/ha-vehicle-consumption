"""Vehicle Consumption: fuel and energy consumption, trips and costs of a vehicle, and the bundled Lovelace card."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import voluptuous as vol
from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry, ConfigEntryState
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED, Platform
from homeassistant.core import CoreState, Event, HomeAssistant, ServiceCall
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from .const import (
    ATTR_CONFIG_ENTRY_ID,
    ATTR_COST,
    ATTR_ENERGY,
    ATTR_LITERS,
    ATTR_ODOMETER,
    ATTR_PRICE,
    CARD_URL,
    CONF_NAME,
    DOMAIN,
    SERVICE_ADD_CHARGE,
    SERVICE_ADD_REFUEL,
    SERVICE_IMPORT_HISTORY,
    SERVICE_RESET_STATISTICS,
    VERSION,
)
from .tracker import ENERGY, FUEL, ConsumptionTracker

_LOGGER = logging.getLogger(__name__)

PLATFORMS = [Platform.SENSOR]
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

type VehicleConsumptionConfigEntry = ConfigEntry[ConsumptionTracker]

_AMOUNT = vol.All(vol.Coerce(float), vol.Range(min=0, min_included=False))
_POSITIVE = vol.All(vol.Coerce(float), vol.Range(min=0))
_ENTRY_SCHEMA = vol.Schema({vol.Required(ATTR_CONFIG_ENTRY_ID): cv.string})


def _event_schema(amount_key: str) -> vol.Schema:
    return _ENTRY_SCHEMA.extend(
        {
            vol.Required(amount_key): _AMOUNT,
            vol.Optional(ATTR_COST): _POSITIVE,
            vol.Optional(ATTR_PRICE): _POSITIVE,
            vol.Optional(ATTR_ODOMETER): _POSITIVE,
        }
    )


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Serve the card, load it on every dashboard and register the actions."""
    await hass.http.async_register_static_paths(
        [StaticPathConfig(CARD_URL, str(Path(__file__).parent / "frontend" / "vehicle-consumption-card.js"), True)]
    )

    async def _register(_: Event | None = None) -> None:
        if not await _async_register_resource(hass):
            # Dashboard resources in YAML mode: load the card on every page instead
            add_extra_js_url(hass, f"{CARD_URL}?v={VERSION}")

    if hass.state is CoreState.running:
        await _register()
    else:
        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _register)

    def tracker(call: ServiceCall) -> ConsumptionTracker:
        entry_id = call.data[ATTR_CONFIG_ENTRY_ID]
        entry = hass.config_entries.async_get_entry(entry_id)
        if entry is None or entry.domain != DOMAIN:
            raise ServiceValidationError(
                translation_domain=DOMAIN,
                translation_key="entry_not_found",
                translation_placeholders={"entry_id": entry_id},
            )
        if entry.state is not ConfigEntryState.LOADED:
            raise ServiceValidationError(
                translation_domain=DOMAIN, translation_key="not_loaded", translation_placeholders={"name": entry.title}
            )
        return entry.runtime_data

    def add_event(kind: str, amount_key: str) -> Any:
        async def handler(call: ServiceCall) -> None:
            tracker(call).async_add_event(
                kind,
                call.data[amount_key],
                cost=call.data.get(ATTR_COST),
                price=call.data.get(ATTR_PRICE),
                odometer=call.data.get(ATTR_ODOMETER),
            )

        return handler

    async def reset(call: ServiceCall) -> None:
        tracker(call).async_reset()

    hass.services.async_register(DOMAIN, SERVICE_ADD_REFUEL, add_event(FUEL, ATTR_LITERS), _event_schema(ATTR_LITERS))
    hass.services.async_register(DOMAIN, SERVICE_ADD_CHARGE, add_event(ENERGY, ATTR_ENERGY), _event_schema(ATTR_ENERGY))

    async def import_history(call: ServiceCall) -> None:
        if not await tracker(call).async_import_history():
            raise ServiceValidationError(translation_domain=DOMAIN, translation_key="no_recorder")

    hass.services.async_register(DOMAIN, SERVICE_RESET_STATISTICS, reset, _ENTRY_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_IMPORT_HISTORY, import_history, _ENTRY_SCHEMA)
    return True


def _storage_resources(hass: HomeAssistant) -> Any | None:
    """Return the dashboard resources collection when it is editable from the UI.

    hass.data["lovelace"] is a dict before 2025.2, then a dataclass whose `mode` field became `resource_mode` in 2026.2.
    """
    lovelace = hass.data.get("lovelace")
    if isinstance(lovelace, dict):
        mode, resources = lovelace.get("resource_mode", lovelace.get("mode")), lovelace.get("resources")
    else:
        mode = getattr(lovelace, "resource_mode", getattr(lovelace, "mode", None))
        resources = getattr(lovelace, "resources", None)
    return resources if mode == "storage" else None


async def _async_register_resource(hass: HomeAssistant) -> bool:
    """Add or update the card in Settings → Dashboards → Resources."""
    resources = _storage_resources(hass)
    if resources is None:
        return False
    url = f"{CARD_URL}?v={VERSION}"
    try:
        await resources.async_get_info()  # loads the collection from storage
        existing = [item for item in resources.async_items() if item.get("url", "").split("?")[0] == CARD_URL]
        if not existing:
            await resources.async_create_item({"res_type": "module", "url": url})
            return True
        if existing[0]["url"] != url:
            await resources.async_update_item(existing[0]["id"], {"res_type": "module", "url": url})
        for duplicate in existing[1:]:
            await resources.async_delete_item(duplicate["id"])
    except Exception:  # noqa: BLE001 - never block the integration on the card
        _LOGGER.exception("Could not register the Vehicle Consumption card as a dashboard resource")
        return False
    return True


async def async_setup_entry(hass: HomeAssistant, entry: VehicleConsumptionConfigEntry) -> bool:
    tracker = ConsumptionTracker(hass, entry.entry_id, entry.data.get(CONF_NAME) or entry.title, dict(entry.options))
    if hass.state is CoreState.running:
        # async_setup runs once per start: after the last entry was removed (which drops the card resource)
        # and one added again, the resource has to come back without a restart.
        await _async_register_resource(hass)
    await tracker.async_load()
    entry.runtime_data = tracker
    entry.async_on_unload(tracker.async_listen())
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(_async_reload))
    if not tracker.history_imported:
        # Once per vehicle: what the sensors recorded before the integration was there (trips, refuels…).
        entry.async_create_background_task(hass, _async_first_import(hass, tracker), f"{DOMAIN} history import")
    return True


async def _async_first_import(hass: HomeAssistant, tracker: ConsumptionTracker) -> None:
    """Read the recorder's history once it is up; a failure leaves the live tracking as it is."""
    if hass.state is not CoreState.running:
        started = hass.loop.create_future()
        unsub = hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, lambda _: started.set_result(None))
        try:
            await started
        finally:
            if not started.done():
                unsub()
    try:
        await tracker.async_import_history()
    except Exception:  # noqa: BLE001 - the history is a bonus, never a reason to stop tracking
        _LOGGER.exception("Could not import the history of %s", tracker.name)


async def async_unload_entry(hass: HomeAssistant, entry: VehicleConsumptionConfigEntry) -> bool:
    await entry.runtime_data.async_save()
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def async_remove_entry(hass: HomeAssistant, entry: VehicleConsumptionConfigEntry) -> None:
    """Drop the stored statistics; with the last vehicle gone, the card resource too."""
    # A vehicle added again starts afresh, not from the figures of the removed entry.
    await ConsumptionTracker(hass, entry.entry_id, entry.title, {}).async_remove()
    if any(e.entry_id != entry.entry_id for e in hass.config_entries.async_entries(DOMAIN)):
        return
    if (resources := _storage_resources(hass)) is None:
        return
    for item in list(resources.async_items()):
        if item.get("url", "").split("?")[0] == CARD_URL:
            await resources.async_delete_item(item["id"])


async def _async_reload(hass: HomeAssistant, entry: VehicleConsumptionConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)

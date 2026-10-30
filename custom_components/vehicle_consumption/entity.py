"""Base entity: one service device per vehicle, entities refreshed with the tracker."""

from __future__ import annotations

from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.entity import Entity

from .const import DOMAIN
from .tracker import ConsumptionTracker


class VehicleConsumptionEntity(Entity):
    """Shared device and update listener."""

    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, tracker: ConsumptionTracker, key: str) -> None:
        self.tracker = tracker
        self._attr_translation_key = key
        self._attr_unique_id = f"{tracker.entry_id}_{key}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, tracker.entry_id)},
            name=tracker.name,
            manufacturer="juju35",
            model="Vehicle Consumption",
            entry_type=DeviceEntryType.SERVICE,
            configuration_url="https://github.com/juju35/ha-vehicle-consumption",
        )

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(self.tracker.async_add_listener(self.async_write_ha_state))

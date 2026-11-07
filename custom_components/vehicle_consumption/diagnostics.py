"""Diagnostics: the entry, the tracker's figures and the source sensors, with personal data redacted."""

from __future__ import annotations

from typing import Any

from homeassistant.components.diagnostics import async_redact_data
from homeassistant.core import HomeAssistant

from . import VehicleConsumptionConfigEntry

# Account data, vehicle identifiers and positions: none is needed to understand a consumption figure. Source sensors
# of the vehicle's own integration often carry some of them in their attributes.
TO_REDACT = {
    "access_token",
    "account",
    "account_id",
    "address",
    "api_key",
    "email",
    "gps",
    "gps_accuracy",
    "home",
    "host",
    "immatriculation",
    "latitude",
    "license_plate",
    "location",
    "longitude",
    "password",
    "plate",
    "position",
    "refresh_token",
    "registration",
    "registration_number",
    "token",
    "tracking_number",
    "url",
    "user",
    "username",
    "vin",
}


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant, entry: VehicleConsumptionConfigEntry
) -> dict[str, Any]:
    """The entry, the tracked figures and the current state of every source sensor."""
    tracker = entry.runtime_data
    sources: dict[str, Any] = {}
    for key, entity_id in tracker.sensors.items():
        state = hass.states.get(entity_id)
        sources[key] = {
            "entity_id": entity_id,
            "state": state.state if state else None,
            "attributes": dict(state.attributes) if state else None,
        }
    return async_redact_data(
        {
            "entry": {"title": entry.title, "data": dict(entry.data), "options": dict(entry.options)},
            "tracker": {
                "trip_gap_minutes": tracker.trip_gap.total_seconds() / 60,
                "history_imported": tracker.history_imported,
                "history_from": tracker.history_from.isoformat() if tracker.history_from else None,
                **tracker.attributes(),
            },
            "sources": sources,
        },
        TO_REDACT,
    )

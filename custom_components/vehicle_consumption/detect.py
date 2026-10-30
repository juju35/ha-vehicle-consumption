"""Find the odometer, fuel and battery sensors of a vehicle device.

The integrations in `_KNOWN` are matched exactly, on their own sensor keys. Every other sensor is matched on
keywords of the entity ID, translation key and name, plus the unit and the device class. Either way the result
only prefills the config flow, where the user checks it.
"""

from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass

from homeassistant.const import ATTR_DEVICE_CLASS, ATTR_UNIT_OF_MEASUREMENT
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er

from .const import CONF_BATTERY_ENERGY, CONF_BATTERY_LEVEL, CONF_FUEL_LEVEL, CONF_FUEL_QUANTITY, CONF_ODOMETER

# Integrations whose sensor keys are known, by entity registry platform: source key -> their sensor keys. A sensor
# matches when its translation key is one of them, or its unique ID ends with one (after `_`, `-` or `.`).
# Every other sensor, and every source left unmatched, goes through the keyword matchers below.
_KNOWN: dict[str, dict[str, tuple[str, ...]]] = {
    # Renault: unique ID `<vin>_<key>`, translation key = key (battery_level has none: the battery device class
    # finds it below).
    "renault": {
        CONF_ODOMETER: ("mileage",),
        CONF_FUEL_QUANTITY: ("fuel_quantity",),
        CONF_BATTERY_ENERGY: ("battery_available_energy",),
        CONF_BATTERY_LEVEL: ("battery_level",),
    },
}


def _known_key(platform: str, translation_key: str | None, unique_id: str) -> str | None:
    """The source a sensor of a known integration provides, from its translation key or unique ID suffix."""
    for conf, keys in _KNOWN.get(platform, {}).items():
        for key in keys:
            if translation_key == key or any(unique_id.endswith(f"{sep}{key}") for sep in "_-."):
                return conf
    return None


_DISTANCE_UNITS = {"km", "mi"}
_VOLUME_UNITS = {"L", "l", "gal"}
_ENERGY_UNITS = {"kWh", "Wh"}


@dataclass(slots=True)
class _Candidate:
    entity_id: str
    text: str  # entity ID, translation key, unique ID and name, lower case: what keywords are searched in
    unit: str | None
    device_class: str | None
    state_class: str | None
    known: str | None  # the source it provides, for an integration whose keys are known

    def has(self, pattern: str) -> bool:
        return re.search(pattern, self.text) is not None


def _odometer(c: _Candidate) -> int:
    if c.device_class != "distance" or c.unit not in _DISTANCE_UNITS:
        return 0
    # Ranges, trip meters and service intervals are distances too: never the odometer.
    if c.has(r"range|autonomy|remaining|trip|service|inspection|oil|until|since"):
        return 0
    if c.has(r"odometer|mileage|kilomet|total_distance|\bodo"):
        return 3
    return 1 if c.state_class == "total_increasing" else 0


def _fuel_quantity(c: _Candidate) -> int:
    if c.unit not in _VOLUME_UNITS or c.device_class not in (None, "volume", "volume_storage"):
        return 0
    if c.has(r"consum|used|added|refuel|total|range"):
        return 0
    return 2 if c.has(r"fuel|tank") else 0


def _fuel_level(c: _Candidate) -> int:
    if c.unit != "%" or c.device_class == "battery" or c.has(r"battery|soc|charge"):
        return 0
    return 2 if c.has(r"fuel|tank") else 0


def _battery_energy(c: _Candidate) -> int:
    if c.unit not in _ENERGY_UNITS or c.device_class not in (None, "energy", "energy_storage"):
        return 0
    # Energy charged, consumed or added is a counter, not what is left in the battery.
    if c.has(r"charged|consumed|added|total|consumption|regen"):
        return 0
    if c.has(r"available_energy|energy_storage|remaining_energy|energy_remaining|energy_left"):
        return 3
    return 2 if c.has(r"battery|soc|usable") else 0


def _battery_level(c: _Candidate) -> int:
    if c.unit != "%":
        return 0
    # 12 V battery, key fob, paired phone… are not the traction battery.
    if c.has(r"12v|12_v|aux|key|phone|fuel|tank|remote|tyre|tire|health|soh|limit|target|max|min"):
        return 0
    if c.has(r"state_of_charge|battery_level|\bsoc\b|_soc\b|\bsoc_"):
        return 3
    return 1 if c.device_class == "battery" else 0


_MATCHERS: dict[str, Callable[[_Candidate], int]] = {
    CONF_ODOMETER: _odometer,
    CONF_FUEL_QUANTITY: _fuel_quantity,
    CONF_FUEL_LEVEL: _fuel_level,
    CONF_BATTERY_ENERGY: _battery_energy,
    CONF_BATTERY_LEVEL: _battery_level,
}


def _candidates(hass: HomeAssistant, device_id: str) -> list[_Candidate]:
    """The device's enabled sensors, with unit and device class from the state (or the registry)."""
    out: list[_Candidate] = []
    for entry in er.async_entries_for_device(er.async_get(hass), device_id):
        if entry.domain != "sensor" or entry.disabled:
            continue
        state = hass.states.get(entry.entity_id)
        attributes = state.attributes if state else {}
        unique_id = str(entry.unique_id).lower()
        out.append(
            _Candidate(
                entity_id=entry.entity_id,
                text=" ".join(
                    s for s in (entry.entity_id, entry.translation_key, unique_id, entry.original_name, entry.name) if s
                ).lower(),
                unit=attributes.get(ATTR_UNIT_OF_MEASUREMENT, entry.unit_of_measurement),
                device_class=attributes.get(ATTR_DEVICE_CLASS, entry.device_class or entry.original_device_class),
                state_class=attributes.get("state_class"),
                known=_known_key(entry.platform, entry.translation_key, unique_id),
            )
        )
    return sorted(out, key=lambda c: c.entity_id)


def async_detect(hass: HomeAssistant, device_id: str) -> dict[str, str]:
    """Map each source sensor key to the entity of the device that most likely provides it."""
    candidates = _candidates(hass, device_id)
    found: dict[str, str] = {}

    for c in candidates:
        if c.known and c.known not in found:
            found[c.known] = c.entity_id

    used = set(found.values())
    for conf, matcher in _MATCHERS.items():
        if conf in found:
            continue
        # Best score wins; ties go to the first entity ID. An entity is used for one source only.
        best = max(
            ((matcher(c), -i, c.entity_id) for i, c in enumerate(candidates) if c.entity_id not in used),
            default=(0, 0, ""),
        )
        if best[0] > 0:
            found[conf] = best[2]
            used.add(best[2])
    return found

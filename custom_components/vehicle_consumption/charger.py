"""Find the energy counter of a home charger (a separate device: the whole entity registry is searched).

Each known charger integration is matched on its platform and the translation key and / or unique ID of its
energy sensor, as written in the integration's source code. A counter of the total energy delivered is preferred;
a session counter (back to 0 at each new session) comes next. The tracker handles both, and the result only
prefills the config flow, where the user checks it.
"""

from __future__ import annotations

import re
from typing import NamedTuple

from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er


class ChargerSensor(NamedTuple):
    """An energy sensor of a charger integration (kWh unless said otherwise)."""

    platform: str  # integration domain
    translation_key: str | None  # matched exactly
    unique_id: str  # regular expression searched in the unique ID (old registry entries may lack the key)
    total: bool  # True: total energy delivered; False: energy of the current / last session


CHARGER_SENSORS: tuple[ChargerSensor, ...] = (
    # evcc, HACS `evcc_intg` (marq24/ha-evcc): custom_components/evcc_intg/const.py, Tag.CHARGETOTALIMPORT /
    # CHARGEDENERGY / SESSIONENERGY per loadpoint (pyevcc_ha/keys.py). sensor.py sets the translation key to the
    # evcc JSON key; __init__.py lower-cases it and builds the unique ID `evcc_intg.<site>_<loadpoint>_<snake key>`.
    ChargerSensor("evcc_intg", "chargetotalimport", r"_charge_total_import$", total=True),
    ChargerSensor("evcc_intg", "sessionenergy", r"_session_energy$", total=False),
    ChargerSensor("evcc_intg", "chargedenergy", r"_charged_energy$", total=False),
    # Easee, HACS `easee` (fondberg/easee_hass): custom_components/easee/const.py, `lifetime_energy`
    # (TOTAL_INCREASING) and `session_energy`; entity.py: unique ID `<charger id>_<name>`.
    ChargerSensor("easee", "lifetime_energy", r"_lifetime_energy$", total=True),
    ChargerSensor("easee", "session_energy", r"_session_energy$", total=False),
    # Zaptec, HACS `zaptec` (custom-components/zaptec): custom_components/zaptec/sensor.py, `signed_meter_value`
    # (key `signed_meter_value_kwh`, the charger's energy meter) and `total_charge_power_session`;
    # entity.py: unique ID `<charger id>_<key>`.
    ChargerSensor("zaptec", "signed_meter_value", r"_signed_meter_value_kwh$", total=True),
    ChargerSensor("zaptec", "total_charge_power_session", r"_total_charge_power_session$", total=False),
    # Wallbox, core `wallbox`: homeassistant/components/wallbox/sensor.py, `added_energy` (energy added by the
    # current / last session); unique ID `added_energy-<serial>`.
    ChargerSensor("wallbox", "added_energy", r"^added_energy-", total=False),
    # Ohme, core `ohme`: homeassistant/components/ohme/sensor.py, key `energy` without translation key (session
    # energy, in Wh shown as kWh); entity.py: unique ID `<serial>_energy`. Removed from core in 2026.7 (#174664),
    # still there on older Home Assistant versions.
    ChargerSensor("ohme", None, r"_energy$", total=False),
)


def _matches(sensor: ChargerSensor, entry: er.RegistryEntry) -> bool:
    if entry.platform != sensor.platform:
        return False
    if sensor.translation_key is not None and entry.translation_key == sensor.translation_key:
        return True
    return re.search(sensor.unique_id, str(entry.unique_id).lower()) is not None


def async_detect_charger(hass: HomeAssistant) -> str | None:
    """Entity ID of the most likely home charger energy counter: total counters first, then session ones."""
    entries = sorted(
        (e for e in er.async_get(hass).entities.values() if e.domain == "sensor" and not e.disabled),
        key=lambda e: e.entity_id,
    )
    for total in (True, False):
        for sensor in CHARGER_SENSORS:
            if sensor.total != total:
                continue
            if found := next((e.entity_id for e in entries if _matches(sensor, e)), None):
                return found
    return None

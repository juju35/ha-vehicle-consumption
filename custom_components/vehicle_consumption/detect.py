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

# Integrations whose sensor keys are known, by entity registry platform: source -> their sensor keys, preferred
# first. A sensor matches when its translation key is one of them, or its unique ID ends with one after `_`, `-`,
# `.` or `/` (in lower case; a `~` key may sit anywhere in it). Every other sensor, and every source left
# unmatched, goes through the keyword matchers below. Keys read from each integration's source code (October 2026).
_KNOWN: dict[str, dict[str, tuple[str, ...]]] = {
    # Renault (core): unique ID `<vin>_<key>`, translation key = key, except battery_level (battery device class).
    "renault": {
        CONF_ODOMETER: ("mileage",),
        CONF_FUEL_QUANTITY: ("fuel_quantity",),
        CONF_BATTERY_ENERGY: ("battery_available_energy",),
        CONF_BATTERY_LEVEL: ("battery_level",),
    },
    # Tesla Fleet, Teslemetry, Tessie (core): unique ID `<vin>-<key>`, translation key = key. The odometer (miles)
    # is disabled by default in Tesla Fleet and Teslemetry: it has to be enabled to be found.
    "tesla_fleet": {
        CONF_ODOMETER: ("vehicle_state_odometer",),
        CONF_BATTERY_LEVEL: ("charge_state_battery_level", "charge_state_usable_battery_level"),
    },
    "teslemetry": {
        CONF_ODOMETER: ("vehicle_state_odometer",),
        CONF_BATTERY_ENERGY: ("energy_remaining",),
        CONF_BATTERY_LEVEL: ("charge_state_battery_level", "charge_state_usable_battery_level"),
    },
    "tessie": {
        CONF_ODOMETER: ("vehicle_state_odometer",),
        CONF_BATTERY_ENERGY: ("charge_state_energy_remaining",),
        CONF_BATTERY_LEVEL: ("charge_state_usable_battery_level",),
    },
    # Kia / Hyundai (HACS kia_uvo): unique ID `kia_uvo_<id>_<key>`; energy left in kJ. car_battery_percentage is
    # the 12 V battery, ev_battery_soh_percentage its health: neither is listed.
    "kia_uvo": {
        CONF_ODOMETER: ("odometer",),
        CONF_FUEL_LEVEL: ("fuel_level",),
        CONF_BATTERY_ENERGY: ("ev_battery_remain",),
        CONF_BATTERY_LEVEL: ("ev_battery_percentage",),
    },
    # BMW Connected Drive (core until 2026.3): unique ID `<vin>-fuel_and_battery.<key>`, short translation keys.
    "bmw_connected_drive": {
        CONF_ODOMETER: ("mileage",),
        CONF_FUEL_QUANTITY: ("remaining_fuel",),
        CONF_FUEL_LEVEL: ("remaining_fuel_percent",),
        CONF_BATTERY_LEVEL: ("remaining_battery_percent",),
    },
    # BMW CarData (HACS cardata, BavarianData): unique ID `<vin>_<CarData descriptor>`.
    "cardata": {
        CONF_ODOMETER: ("vehicle.vehicle.travelleddistance",),
        CONF_FUEL_QUANTITY: ("vehicle.drivetrain.fuelsystem.remainingfuel",),
        CONF_FUEL_LEVEL: ("vehicle.drivetrain.fuelsystem.level",),
        CONF_BATTERY_LEVEL: (
            "vehicle.drivetrain.batterymanagement.header",
            "vehicle.powertrain.electric.battery.stateofcharge.displayed",
        ),
    },
    "bavariandata": {
        CONF_ODOMETER: ("vehicle.vehicle.mileage", "vehicle.vehicle.travelleddistance"),
        CONF_FUEL_QUANTITY: ("vehicle.drivetrain.fuelsystem.remainingfuel",),
        CONF_FUEL_LEVEL: ("vehicle.drivetrain.fuelsystem.level",),
        CONF_BATTERY_LEVEL: ("vehicle.drivetrain.batterymanagement.header",),
    },
    # Mercedes-Benz (HACS mbapi2020): unique ID `<vin>_<name>` in lower case, translation key = name in lower case.
    "mbapi2020": {
        CONF_ODOMETER: ("odometer",),
        CONF_FUEL_LEVEL: ("tanklevelpercent", "gastanklevelpercent"),
        CONF_BATTERY_LEVEL: ("soc",),
    },
    # Toyota / Lexus (HACS ha_toyota): unique ID `<entry>_<vin>/<key>`, translation key = key.
    "toyota": {
        CONF_ODOMETER: ("odometer",),
        CONF_FUEL_LEVEL: ("fuel_level",),
        CONF_BATTERY_LEVEL: ("battery_level", "phev_usable_battery_level"),
    },
    # Volvo (core; HACS volvo_cars before it): unique ID `[volvo_]<vin>_<key>` in lower case.
    "volvo": {
        CONF_ODOMETER: ("odometer",),
        CONF_FUEL_QUANTITY: ("fuel_amount",),
        CONF_BATTERY_LEVEL: ("battery_charge_level",),
    },
    "volvo_cars": {
        CONF_ODOMETER: ("odometer",),
        CONF_FUEL_QUANTITY: ("fuel_amount",),
        CONF_BATTERY_LEVEL: ("battery_charge_level",),
    },
    # Polestar (HACS polestar_api): unique ID `polestar_<vin>_<key>`.
    "polestar_api": {
        CONF_ODOMETER: ("current_odometer",),
        CONF_BATTERY_LEVEL: ("battery_charge_level",),
    },
    # Volkswagen (HACS volkswagencarnet) and SEAT (HACS seatconnect): unique ID `<vin>-<component>-<attribute>`,
    # no translation key. connection_state_battery_power_level is not the battery level: the whole suffix counts.
    "volkswagencarnet": {
        CONF_ODOMETER: ("sensor-distance",),
        CONF_FUEL_LEVEL: ("sensor-fuel_level",),
        CONF_BATTERY_LEVEL: ("sensor-battery_level",),
    },
    "seatconnect": {
        CONF_ODOMETER: ("sensor-distance",),
        CONF_FUEL_LEVEL: ("sensor-fuel_level",),
        CONF_BATTERY_LEVEL: ("sensor-battery_level",),
    },
    # Volkswagen ID (HACS volkswagen_we_connect_id) and CUPRA (HACS cupra_we_connect): unique ID `<vin>-<key>`.
    "volkswagen_we_connect_id": {
        CONF_ODOMETER: ("odometer",),
        CONF_FUEL_LEVEL: ("fuellevel",),
        CONF_BATTERY_LEVEL: ("currentsoc_pct",),
    },
    "cupra_we_connect": {
        CONF_ODOMETER: ("odometer_km", "odometer_mi"),
        CONF_BATTERY_LEVEL: ("currentsoc_pct",),
    },
    # Audi (HACS audiconnect): unique ID `<vin>_sensor_<key>`, no translation key.
    "audiconnect": {
        CONF_ODOMETER: ("sensor_mileage",),
        CONF_FUEL_LEVEL: ("sensor_tank_level",),
        CONF_BATTERY_LEVEL: ("sensor_state_of_charge",),
    },
    # Škoda (HACS myskoda): translation keys (the odometer's own key is spelled `milage`).
    "myskoda": {
        CONF_ODOMETER: ("mileage",),
        CONF_FUEL_LEVEL: ("fuel_level",),
        CONF_BATTERY_LEVEL: ("battery_percentage",),
    },
    # Peugeot, Citroën, DS, Opel, Fiat, Jeep… (HACS stellantis_vehicles): translation key = key.
    "stellantis_vehicles": {
        CONF_ODOMETER: ("mileage",),
        CONF_FUEL_LEVEL: ("fuel",),
        CONF_BATTERY_ENERGY: ("battery_residual",),
        CONF_BATTERY_LEVEL: ("battery",),
    },
    # Ford (HACS fordpass): unique ID `<vin>-fordpass_<key>`; on an electric Ford `fuel` holds the battery level.
    "fordpass": {
        CONF_ODOMETER: ("fordpass_odometer",),
        CONF_FUEL_LEVEL: ("fordpass_fuel",),
    },
    # Nissan Leaf (core): unique ID `<vin>_soc`; no odometer.
    "nissan_leaf": {
        CONF_BATTERY_LEVEL: ("soc",),
    },
    # MG / SAIC (HACS mg_saic): unique ID `<entry>_<vin>_<key>`; its fuel level wrongly has the battery device class.
    "mg_saic": {
        CONF_ODOMETER: ("mileage",),
        CONF_FUEL_LEVEL: ("fuellevelprc",),
        CONF_BATTERY_ENERGY: ("battery_energy",),
        CONF_BATTERY_LEVEL: ("extendeddata1_soc",),
    },
    # BYD (HACS byd_vehicle): translation key = key.
    "byd_vehicle": {
        CONF_ODOMETER: ("total_mileage", "total_mileage_v2"),
        CONF_FUEL_LEVEL: ("oil_percent",),
        CONF_BATTERY_LEVEL: ("elec_percent",),
    },
    # OVMS (HACS ovms): unique ID `ovms_<entry>_<vehicle>_<topic path>_<hash>`, matched on the topic path (`~`).
    "ovms": {
        CONF_ODOMETER: ("~_metric_v_p_odometer_",),
        CONF_BATTERY_LEVEL: ("~_metric_v_b_soc_",),
    },
    # WiCAN OBD-II dongle (HACS wican): unique ID `<entry>_pid_<PID>`, PIDs from the vehicle profile or standard OBD.
    # LV_SOC is the 12 V battery.
    "wican": {
        CONF_ODOMETER: ("pid_odometer", "pid_odometer_mi"),
        CONF_FUEL_QUANTITY: ("pid_fuel_l",),
        CONF_FUEL_LEVEL: ("pid_fuel", "pid_fueltanklevel"),
        CONF_BATTERY_LEVEL: ("pid_soc", "pid_soc_d"),
    },
}

# Integrations matched on their translation keys only: their short keys also end other sensors' unique IDs
# (BYD's energy_cumulative_total_mileage, Škoda's overall_mileage…).
_TRANSLATION_KEY_ONLY = {"myskoda", "stellantis_vehicles", "byd_vehicle", "mbapi2020"}


def _uid_matches(unique_id: str, key: str) -> bool:
    """A unique ID ends with the key after a separator, or holds it anywhere for a `~` key."""
    if key.startswith("~"):
        return key[1:] in unique_id
    return any(unique_id.endswith(f"{sep}{key}") for sep in "_-./")


def _known_key(platform: str, translation_key: str | None, unique_id: str) -> tuple[str, int] | None:
    """The source a sensor of a known integration provides and the rank of its key (0: preferred), from its
    translation key or unique ID suffix."""
    tkey, uid = (translation_key or "").lower(), unique_id.lower()
    matches = [
        (len(key), conf, rank)
        for conf, keys in _KNOWN.get(platform, {}).items()
        for rank, key in enumerate(keys)
        if tkey == key or (platform not in _TRANSLATION_KEY_ONLY and _uid_matches(uid, key))
    ]
    # The longest key is the most specific: `phev_usable_battery_level` also ends with `_battery_level`.
    return max(matches)[1:] if matches else None


_DISTANCE_UNITS = {"km", "mi"}
_VOLUME_UNITS = {"L", "l", "gal"}
_ENERGY_UNITS = {"kWh", "Wh", "kJ", "MJ"}


@dataclass(slots=True)
class _Candidate:
    entity_id: str
    text: str  # entity ID, translation key, unique ID and name, lower case: what keywords are searched in
    unit: str | None
    device_class: str | None
    state_class: str | None
    known: tuple[str, int] | None  # the source it provides and the key rank, for an integration whose keys are known

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

    # Known keys first, the preferred key of each source winning over the others.
    for c in sorted((c for c in candidates if c.known), key=lambda c: (c.known[1], c.entity_id)):
        if c.known[0] not in found:
            found[c.known[0]] = c.entity_id

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

"""Constants for Vehicle Consumption."""

from __future__ import annotations

from datetime import timedelta
from typing import Final

DOMAIN: Final = "vehicle_consumption"
VERSION: Final = "0.2.5"

# Entry data
CONF_DEVICE_ID: Final = "device_id"
CONF_NAME: Final = "name"

# Source sensors
CONF_ODOMETER: Final = "odometer"
CONF_FUEL_QUANTITY: Final = "fuel_quantity"
CONF_FUEL_LEVEL: Final = "fuel_level"
CONF_BATTERY_ENERGY: Final = "battery_energy"
CONF_BATTERY_LEVEL: Final = "battery_level"
SENSOR_KEYS: Final = (CONF_ODOMETER, CONF_FUEL_QUANTITY, CONF_FUEL_LEVEL, CONF_BATTERY_ENERGY, CONF_BATTERY_LEVEL)

# Energy counter of a home charger (total or per session, kWh): home charges are measured at the charger.
CONF_CHARGER_ENERGY: Final = "charger_energy"

# Capacities, to turn a level (%) into litres / kWh
CONF_TANK_CAPACITY: Final = "tank_capacity"
CONF_BATTERY_CAPACITY: Final = "battery_capacity"

# Prices: the entity's numeric state wins over the fixed price
CONF_FUEL_PRICE_ENTITY: Final = "fuel_price_entity"
CONF_FUEL_PRICE: Final = "fuel_price"
CONF_ELECTRICITY_PRICE_ENTITY: Final = "electricity_price_entity"
CONF_ELECTRICITY_PRICE: Final = "electricity_price"

# Tuning
CONF_TRIP_GAP: Final = "trip_gap"
CONF_REFUEL_THRESHOLD: Final = "refuel_threshold"
CONF_CHARGE_THRESHOLD: Final = "charge_threshold"

# A trip ends after this many minutes without the odometer moving.
DEFAULT_TRIP_GAP: Final = 30
# A fuel rise of at least this many litres is a refuel; smaller rises are sensor noise.
DEFAULT_REFUEL_THRESHOLD: Final = 3.0
# A battery rise of at least this many kWh is a charge; smaller rises are noise (temperature, recalibration).
DEFAULT_CHARGE_THRESHOLD: Final = 1.0

# A home charge session ends after this long without the charger counter going up.
CHARGER_SESSION_GAP: Final = timedelta(minutes=30)
# A battery rise is the charger's session (not counted again) when the counter moved this close to it.
CHARGER_OVERLAP: Final = timedelta(minutes=10)

# A charger counter step above this (kWh) is a glitch or a replaced meter, not a charge: not counted.
MAX_CHARGER_STEP: Final = 250.0

# Below this distance (km) a consumption figure means nothing (a few hundred metres, one litre): None.
MIN_DISTANCE: Final = 5.0
# An odometer jump above this (km) is a sensor reset or a replaced car, not a drive: not counted.
MAX_ODOMETER_JUMP: Final = 2000.0

MAX_MONTHS: Final = 24
MAX_TRIPS: Final = 20
MAX_EVENTS: Final = 20

KIND_FUEL: Final = "fuel"
KIND_ELECTRIC: Final = "electric"
KIND_PLUGIN_HYBRID: Final = "plugin_hybrid"

UNIT_FUEL_CONSUMPTION: Final = "L/100 km"
UNIT_ENERGY_CONSUMPTION: Final = "kWh/100 km"

SERVICE_ADD_REFUEL: Final = "add_refuel"
SERVICE_ADD_CHARGE: Final = "add_charge"
SERVICE_RESET_STATISTICS: Final = "reset_statistics"
SERVICE_IMPORT_HISTORY: Final = "import_history"
# How far back the history is read by default (days): the recorded states first, the hourly statistics before.
DEFAULT_HISTORY_DAYS: Final = 60
MAX_HISTORY_DAYS: Final = 730
ATTR_DAYS: Final = "days"
ATTR_CONFIG_ENTRY_ID: Final = "config_entry_id"
ATTR_LITERS: Final = "liters"
ATTR_ENERGY: Final = "energy"
ATTR_COST: Final = "cost"
ATTR_PRICE: Final = "price"
ATTR_ODOMETER: Final = "odometer"

STORAGE_VERSION: Final = 1
# One store per entry: `.storage/vehicle_consumption.<entry_id>`.
STORAGE_KEY: Final = DOMAIN + ".{entry_id}"
# Seconds a change waits before .storage is written (several sensors often change together).
SAVE_DELAY: Final = 10

CARD_URL: Final = f"/{DOMAIN}/vehicle-consumption-card.js"

"""Constants for Vehicle Consumption."""

from __future__ import annotations

from datetime import timedelta
from typing import Final

DOMAIN: Final = "vehicle_consumption"
VERSION: Final = "1.6.0"

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
CONF_FUEL_TYPE: Final = "fuel_type"
CONF_CO2_ELECTRICITY: Final = "co2_electricity"
# Tailpipe CO₂ (kg per litre burnt) of each fuel, and the grid CO₂ (g per kWh) by default (France, 2024 average).
FUEL_TYPES: Final = ("petrol", "diesel", "lpg", "e85")
FUEL_CO2: Final = {"petrol": 2.31, "diesel": 2.68, "lpg": 1.66, "e85": 1.61}
DEFAULT_FUEL_TYPE: Final = "petrol"
DEFAULT_CO2_ELECTRICITY: Final = 55.0

# Units of the figures shown (attributes, card, consumption sensors): metric (km, L, L/100 km, kWh/100 km) or imperial
# (miles, US gallons, mpg, mi/kWh). Tracked and stored in km / L / kWh either way.
CONF_UNITS: Final = "units"
UNITS_METRIC: Final = "metric"
UNITS_IMPERIAL: Final = "imperial"
UNIT_SYSTEMS: Final = (UNITS_METRIC, UNITS_IMPERIAL)
DEFAULT_UNITS: Final = UNITS_METRIC

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

# Trip figures from a coarse level sensor (Renault: whole litres): a trip whose expected use is under this many steps of
# the sensor gets its fuel / energy estimated from its distance (the drop measured is mostly rounding), at the average
# consumption of the months up to the trip covering at least `ESTIMATE_WINDOW_KM` (else the whole period's).
ESTIMATE_STEPS: Final = 5
ESTIMATE_WINDOW_KM: Final = 300.0

# Below this distance (km) a consumption figure means nothing (a few hundred metres, one litre): None.
MIN_DISTANCE: Final = 5.0
# An odometer jump above this (km) is a sensor reset or a replaced car, not a drive: not counted.
MAX_ODOMETER_JUMP: Final = 2000.0
# Highest average speed (km/h) between two odometer readings: what a gap longer than the trip gap can hide of driving.
MAX_SPEED: Final = 130.0

MAX_MONTHS: Final = 24
# Trips, refuels and charges are kept this many days (and months for 24 months); the history is rebuilt over as long.
HISTORY_DAYS: Final = 365
# Safety cap on what is stored of each list, whatever the days kept.
MAX_STORED: Final = 5000
# How many of the newest trips, refuels and charges are listed in the attributes (the card shows a few).
MAX_TRIPS: Final = 20
MAX_EVENTS: Final = 20

KIND_FUEL: Final = "fuel"
KIND_ELECTRIC: Final = "electric"
KIND_PLUGIN_HYBRID: Final = "plugin_hybrid"

UNIT_FUEL_CONSUMPTION: Final = "L/100 km"
UNIT_ENERGY_CONSUMPTION: Final = "kWh/100 km"
UNIT_MPG: Final = "mpg"
UNIT_MI_PER_KWH: Final = "mi/kWh"

SERVICE_ADD_REFUEL: Final = "add_refuel"
SERVICE_ADD_CHARGE: Final = "add_charge"
SERVICE_RESET_STATISTICS: Final = "reset_statistics"
SERVICE_IMPORT_HISTORY: Final = "import_history"
# How far back the history is read by default (days): the recorded states first, the hourly statistics before.
DEFAULT_HISTORY_DAYS: Final = HISTORY_DAYS
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

# Fired on the event bus once a closed trip is final: it can no longer be reopened by a late odometer reading.
EVENT_TRIP_ENDED: Final = f"{DOMAIN}_trip_ended"
# An odometer polled every hour (Renault, MyPeugeot…) reports the rest of a drive up to an hour after its last move:
# a closed trip is only final (announced, never reopened) once this long, or `trip_gap` if longer, has passed.
TRIP_REOPEN_WINDOW: Final = timedelta(minutes=65)

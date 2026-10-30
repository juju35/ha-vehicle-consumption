"""Tests for the config flow (auto-detection included) and the options flow."""

from __future__ import annotations

from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType

from custom_components.vehicle_consumption.const import (
    CONF_BATTERY_CAPACITY,
    CONF_BATTERY_ENERGY,
    CONF_BATTERY_LEVEL,
    CONF_CHARGE_THRESHOLD,
    CONF_DEVICE_ID,
    CONF_ELECTRICITY_PRICE,
    CONF_FUEL_LEVEL,
    CONF_FUEL_PRICE,
    CONF_FUEL_PRICE_ENTITY,
    CONF_FUEL_QUANTITY,
    CONF_NAME,
    CONF_ODOMETER,
    CONF_REFUEL_THRESHOLD,
    CONF_TANK_CAPACITY,
    CONF_TRIP_GAP,
    DOMAIN,
)
from custom_components.vehicle_consumption.detect import async_detect

from .conftest import KM, KWH, LITERS, PERCENT, add_sensor, setup_vehicle, state_of, vehicle_device


def _renault(hass: HomeAssistant) -> str:
    """A Renault plug-in hybrid with its usual sensors (unique IDs `<vin>_<key>`)."""
    device = vehicle_device(hass, "Espace")
    add_sensor(hass, device, "espace_mileage", "48210", KM, unique_id="vf1_mileage", translation_key="mileage")
    add_sensor(
        hass,
        device,
        "espace_fuel_quantity",
        "32",
        LITERS,
        unique_id="vf1_fuel_quantity",
        translation_key="fuel_quantity",
    )
    add_sensor(
        hass, device, "espace_fuel_autonomy", "450", {"unit_of_measurement": "km", "device_class": "distance"},
        unique_id="vf1_fuel_autonomy", translation_key="fuel_autonomy",
    )  # fmt: skip
    add_sensor(
        hass, device, "espace_battery_available_energy", "9.8", KWH,
        unique_id="vf1_battery_available_energy", translation_key="battery_available_energy",
    )  # fmt: skip
    add_sensor(
        hass, device, "espace_battery", "76", {"unit_of_measurement": "%", "device_class": "battery"},
        unique_id="vf1_battery_level",
    )  # fmt: skip
    return device


async def test_renault_detection(hass: HomeAssistant) -> None:
    device = _renault(hass)
    assert async_detect(hass, device) == {
        CONF_ODOMETER: "sensor.espace_mileage",
        CONF_FUEL_QUANTITY: "sensor.espace_fuel_quantity",
        CONF_BATTERY_ENERGY: "sensor.espace_battery_available_energy",
        CONF_BATTERY_LEVEL: "sensor.espace_battery",
    }


async def test_generic_tesla_like_detection(hass: HomeAssistant) -> None:
    device = vehicle_device(hass, "Model 3", platform="teslemetry")
    add_sensor(
        hass, device, "model_3_odometer", "21000", {"unit_of_measurement": "mi", "device_class": "distance",
        "state_class": "total_increasing"}, platform="teslemetry", translation_key="vehicle_state_odometer",
    )  # fmt: skip
    add_sensor(
        hass, device, "model_3_battery_range", "250", {"unit_of_measurement": "mi", "device_class": "distance"},
        platform="teslemetry", translation_key="charge_state_battery_range",
    )  # fmt: skip
    add_sensor(
        hass, device, "model_3_battery_level", "80", {"unit_of_measurement": "%", "device_class": "battery"},
        platform="teslemetry", translation_key="charge_state_battery_level",
    )  # fmt: skip
    add_sensor(
        hass, device, "model_3_energy_remaining", "52.1", KWH,
        platform="teslemetry", translation_key="energy_remaining",
    )  # fmt: skip
    add_sensor(
        hass, device, "model_3_charge_energy_added", "12", {"unit_of_measurement": "kWh", "device_class": "energy"},
        platform="teslemetry", translation_key="charge_state_charge_energy_added",
    )  # fmt: skip
    add_sensor(
        hass, device, "model_3_key_battery", "90", {"unit_of_measurement": "%", "device_class": "battery"},
        platform="teslemetry",
    )  # fmt: skip
    # Disabled entities are never proposed
    add_sensor(
        hass, device, "model_3_soc_disabled", "80", PERCENT, platform="teslemetry", disabled=True,
    )  # fmt: skip
    assert async_detect(hass, device) == {
        CONF_ODOMETER: "sensor.model_3_odometer",
        CONF_BATTERY_ENERGY: "sensor.model_3_energy_remaining",
        CONF_BATTERY_LEVEL: "sensor.model_3_battery_level",
    }


async def test_generic_kia_like_detection(hass: HomeAssistant) -> None:
    """Kia / Hyundai: odometer by name, fuel level in %, 12 V battery left out."""
    device = vehicle_device(hass, "Niro", platform="kia_uvo")
    add_sensor(
        hass, device, "niro_odometer", "35000", {"unit_of_measurement": "km", "device_class": "distance"},
        platform="kia_uvo", original_name="Odometer",
    )  # fmt: skip
    add_sensor(hass, device, "niro_fuel_level", "62", PERCENT, platform="kia_uvo", original_name="Fuel Level")
    add_sensor(
        hass, device, "niro_car_battery_level", "88", {"unit_of_measurement": "%", "device_class": "battery"},
        platform="kia_uvo", original_name="Car Battery Level 12V",
    )  # fmt: skip
    add_sensor(
        hass, device, "niro_ev_battery_level", "70", {"unit_of_measurement": "%", "device_class": "battery"},
        platform="kia_uvo", original_name="EV Battery Level",
    )  # fmt: skip
    assert async_detect(hass, device) == {
        CONF_ODOMETER: "sensor.niro_odometer",
        CONF_FUEL_LEVEL: "sensor.niro_fuel_level",
        CONF_BATTERY_LEVEL: "sensor.niro_ev_battery_level",
    }


async def test_full_flow_renault(hass: HomeAssistant) -> None:
    device = _renault(hass)
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": "user"})
    assert result["type"] is FlowResultType.FORM and result["step_id"] == "user"

    result = await hass.config_entries.flow.async_configure(result["flow_id"], {CONF_DEVICE_ID: device})
    assert result["type"] is FlowResultType.FORM and result["step_id"] == "sensors"
    assert result["description_placeholders"] == {"name": "Espace", "found": "4"}
    # Detected sensors are suggested
    suggested = {str(k): k.description["suggested_value"] for k in result["data_schema"].schema if k.description}
    assert suggested[CONF_ODOMETER] == "sensor.espace_mileage"
    assert suggested[CONF_BATTERY_ENERGY] == "sensor.espace_battery_available_energy"

    result = await hass.config_entries.flow.async_configure(
        result["flow_id"],
        {
            CONF_ODOMETER: "sensor.espace_mileage",
            CONF_FUEL_QUANTITY: "sensor.espace_fuel_quantity",
            CONF_BATTERY_ENERGY: "sensor.espace_battery_available_energy",
            CONF_BATTERY_LEVEL: "sensor.espace_battery",
        },
    )
    assert result["type"] is FlowResultType.FORM and result["step_id"] == "prices"

    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {CONF_FUEL_PRICE: 1.85, CONF_ELECTRICITY_PRICE: 0.2}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["title"] == "Espace"
    assert result["data"] == {CONF_DEVICE_ID: device, CONF_NAME: "Espace"}
    assert result["options"] == {
        CONF_ODOMETER: "sensor.espace_mileage",
        CONF_FUEL_QUANTITY: "sensor.espace_fuel_quantity",
        CONF_BATTERY_ENERGY: "sensor.espace_battery_available_energy",
        CONF_BATTERY_LEVEL: "sensor.espace_battery",
        CONF_FUEL_PRICE: 1.85,
        CONF_ELECTRICITY_PRICE: 0.2,
        CONF_TRIP_GAP: 30.0,
        CONF_REFUEL_THRESHOLD: 3.0,
        CONF_CHARGE_THRESHOLD: 1.0,
    }
    await hass.async_block_till_done()
    assert state_of(hass, "consumption", "Espace").attributes["kind"] == "plugin_hybrid"

    # Same vehicle again: aborted
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": "user"})
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {CONF_DEVICE_ID: device})
    assert result["type"] is FlowResultType.ABORT and result["reason"] == "already_configured"


async def test_custom_name(hass: HomeAssistant) -> None:
    device = _renault(hass)
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": "user"})
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {CONF_DEVICE_ID: device, CONF_NAME: "  Family car "}
    )
    assert result["description_placeholders"]["name"] == "Family car"


async def test_sensor_errors(hass: HomeAssistant) -> None:
    device = vehicle_device(hass, "Clio")
    add_sensor(hass, device, "clio_mileage", "1000", KM, unique_id="vf2_mileage", translation_key="mileage")
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": "user"})
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {CONF_DEVICE_ID: device})

    result = await hass.config_entries.flow.async_configure(result["flow_id"], {CONF_ODOMETER: "sensor.clio_mileage"})
    assert result["errors"] == {"base": "no_energy_sensor"}

    result = await hass.config_entries.flow.async_configure(
        result["flow_id"],
        {CONF_ODOMETER: "sensor.clio_mileage", CONF_FUEL_LEVEL: "sensor.a", CONF_BATTERY_LEVEL: "sensor.b"},
    )
    assert result["errors"] == {
        CONF_TANK_CAPACITY: "tank_capacity_required",
        CONF_BATTERY_CAPACITY: "battery_capacity_required",
    }
    # The values typed are kept
    suggested = {str(k): k.description["suggested_value"] for k in result["data_schema"].schema if k.description}
    assert suggested[CONF_FUEL_LEVEL] == "sensor.a"

    # A quantity sensor makes the capacity unnecessary
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"],
        {CONF_ODOMETER: "sensor.clio_mileage", CONF_FUEL_LEVEL: "sensor.a", CONF_FUEL_QUANTITY: "sensor.q"},
    )
    assert result["step_id"] == "prices"


async def test_options_flow(hass: HomeAssistant) -> None:
    entry = await setup_vehicle(hass)
    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert result["type"] is FlowResultType.FORM and result["step_id"] == "init"

    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {CONF_ODOMETER: "sensor.car_mileage", CONF_FUEL_LEVEL: "sensor.car_fuel_level"}
    )
    assert result["errors"] == {CONF_TANK_CAPACITY: "tank_capacity_required"}

    result = await hass.config_entries.options.async_configure(
        result["flow_id"],
        {CONF_ODOMETER: "sensor.car_mileage", CONF_FUEL_LEVEL: "sensor.car_fuel_level", CONF_TANK_CAPACITY: 55},
    )
    assert result["step_id"] == "prices"
    suggested = {str(k): k.description["suggested_value"] for k in result["data_schema"].schema if k.description}
    assert suggested[CONF_TRIP_GAP] == 30

    hass.states.async_set("sensor.car_fuel_level", "50", PERCENT)
    result = await hass.config_entries.options.async_configure(
        result["flow_id"],
        {
            CONF_FUEL_PRICE_ENTITY: "sensor.station",
            CONF_TRIP_GAP: 15,
            CONF_REFUEL_THRESHOLD: 5,
            CONF_CHARGE_THRESHOLD: 2,
        },
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert entry.options == {
        CONF_ODOMETER: "sensor.car_mileage",
        CONF_FUEL_LEVEL: "sensor.car_fuel_level",
        CONF_TANK_CAPACITY: 55.0,
        CONF_FUEL_PRICE_ENTITY: "sensor.station",
        CONF_TRIP_GAP: 15.0,
        CONF_REFUEL_THRESHOLD: 5.0,
        CONF_CHARGE_THRESHOLD: 2.0,
    }
    await hass.async_block_till_done()
    # Reloaded with the new options
    attrs = state_of(hass, "consumption").attributes
    assert attrs["tank_capacity"] == 55 and attrs["fuel_quantity"] == 27.5

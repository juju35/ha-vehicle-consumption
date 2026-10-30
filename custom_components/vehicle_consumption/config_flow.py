"""Config flow for Vehicle Consumption: one entry per vehicle device.

Steps: `user` (the vehicle device and a name), `sensors` (prefilled by the auto-detection), `prices`.
The device and the name go in the entry data, everything else in the options (changed by the options flow).
"""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.core import callback
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers.selector import (
    DeviceSelector,
    DeviceSelectorConfig,
    EntityFilterSelectorConfig,
    EntitySelector,
    EntitySelectorConfig,
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    TextSelector,
)

from .const import (
    CONF_BATTERY_CAPACITY,
    CONF_BATTERY_ENERGY,
    CONF_BATTERY_LEVEL,
    CONF_CHARGE_THRESHOLD,
    CONF_DEVICE_ID,
    CONF_ELECTRICITY_PRICE,
    CONF_ELECTRICITY_PRICE_ENTITY,
    CONF_FUEL_LEVEL,
    CONF_FUEL_PRICE,
    CONF_FUEL_PRICE_ENTITY,
    CONF_FUEL_QUANTITY,
    CONF_NAME,
    CONF_ODOMETER,
    CONF_REFUEL_THRESHOLD,
    CONF_TANK_CAPACITY,
    CONF_TRIP_GAP,
    DEFAULT_CHARGE_THRESHOLD,
    DEFAULT_REFUEL_THRESHOLD,
    DEFAULT_TRIP_GAP,
    DOMAIN,
    SENSOR_KEYS,
)
from .detect import async_detect

_SENSOR = EntitySelector(EntitySelectorConfig(domain="sensor"))
_PRICE_ENTITY = EntitySelector(EntitySelectorConfig(domain=["sensor", "input_number", "number"]))
_ENERGY_SOURCES = tuple(key for key in SENSOR_KEYS if key != CONF_ODOMETER)
_PRICE_KEYS = (CONF_FUEL_PRICE_ENTITY, CONF_FUEL_PRICE, CONF_ELECTRICITY_PRICE_ENTITY, CONF_ELECTRICITY_PRICE)
_TUNING = (
    (CONF_TRIP_GAP, DEFAULT_TRIP_GAP),
    (CONF_REFUEL_THRESHOLD, DEFAULT_REFUEL_THRESHOLD),
    (CONF_CHARGE_THRESHOLD, DEFAULT_CHARGE_THRESHOLD),
)


def _number(minimum: float, maximum: float, step: float | str, unit: str | None = None) -> NumberSelector:
    return NumberSelector(
        NumberSelectorConfig(min=minimum, max=maximum, step=step, mode=NumberSelectorMode.BOX, unit_of_measurement=unit)
    )


def _sensors_schema() -> vol.Schema:
    """Source sensors and capacities; values come in as suggestions, so an optional field can be emptied."""
    return vol.Schema(
        {
            vol.Required(CONF_ODOMETER): _SENSOR,
            **{vol.Optional(key): _SENSOR for key in _ENERGY_SOURCES},
            vol.Optional(CONF_TANK_CAPACITY): _number(1, 500, 0.1, "L"),
            vol.Optional(CONF_BATTERY_CAPACITY): _number(1, 300, 0.1, "kWh"),
        }
    )


def _prices_schema(currency: str, tuning: bool) -> vol.Schema:
    schema: dict[Any, Any] = {
        vol.Optional(CONF_FUEL_PRICE_ENTITY): _PRICE_ENTITY,
        vol.Optional(CONF_FUEL_PRICE): _number(0, 100, "any", f"{currency}/L"),
        vol.Optional(CONF_ELECTRICITY_PRICE_ENTITY): _PRICE_ENTITY,
        vol.Optional(CONF_ELECTRICITY_PRICE): _number(0, 100, "any", f"{currency}/kWh"),
    }
    if tuning:
        schema |= {
            vol.Required(CONF_TRIP_GAP): _number(5, 720, 1, "min"),
            vol.Required(CONF_REFUEL_THRESHOLD): _number(0.5, 50, 0.1, "L"),
            vol.Required(CONF_CHARGE_THRESHOLD): _number(0.1, 50, 0.1, "kWh"),
        }
    return vol.Schema(schema)


def _validate_sensors(user_input: dict[str, Any]) -> dict[str, str]:
    """Errors of the sensors step: an energy source is needed, and a level (%) needs the capacity."""
    if not any(user_input.get(key) for key in _ENERGY_SOURCES):
        return {"base": "no_energy_sensor"}
    errors: dict[str, str] = {}
    # A level only feeds the tracking when no quantity sensor is given, and then needs the capacity.
    if (
        user_input.get(CONF_FUEL_LEVEL)
        and not user_input.get(CONF_FUEL_QUANTITY)
        and not user_input.get(CONF_TANK_CAPACITY)
    ):
        errors[CONF_TANK_CAPACITY] = "tank_capacity_required"
    if (
        user_input.get(CONF_BATTERY_LEVEL)
        and not user_input.get(CONF_BATTERY_ENERGY)
        and not user_input.get(CONF_BATTERY_CAPACITY)
    ):
        errors[CONF_BATTERY_CAPACITY] = "battery_capacity_required"
    return errors


def _clean(user_input: dict[str, Any], keys: tuple[str, ...]) -> dict[str, Any]:
    """The given values of `keys`, numbers as float; emptied fields left out."""
    out: dict[str, Any] = {}
    for key in keys:
        value = user_input.get(key)
        if value in (None, ""):
            continue
        out[key] = float(value) if isinstance(value, int | float) else value
    return out


def _tuning(user_input: dict[str, Any]) -> dict[str, Any]:
    return {key: float(user_input.get(key, default)) for key, default in _TUNING}


async def _sensors_step(
    flow: VehicleConsumptionConfigFlow | VehicleConsumptionOptionsFlow,
    step_id: str,
    user_input: dict[str, Any] | None,
    defaults: dict[str, Any],
    placeholders: dict[str, str] | None = None,
) -> ConfigFlowResult:
    """The sensors and capacities step, shared by the config and options flows: on to the prices once valid."""
    errors = _validate_sensors(user_input) if user_input is not None else {}
    if user_input is not None and not errors:
        flow._options = _clean(user_input, (*SENSOR_KEYS, CONF_TANK_CAPACITY, CONF_BATTERY_CAPACITY))
        return await flow.async_step_prices()
    return flow.async_show_form(
        step_id=step_id,
        data_schema=flow.add_suggested_values_to_schema(_sensors_schema(), user_input or defaults),
        errors=errors,
        description_placeholders=placeholders,
    )


class VehicleConsumptionConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle the config flow."""

    VERSION = 1

    def __init__(self) -> None:
        self._data: dict[str, Any] = {}
        self._options: dict[str, Any] = {}

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            device_id: str = user_input[CONF_DEVICE_ID]
            await self.async_set_unique_id(device_id)
            self._abort_if_unique_id_configured()
            device = dr.async_get(self.hass).async_get(device_id)
            default_name = (device.name_by_user or device.name) if device else None
            name = str(user_input.get(CONF_NAME) or default_name or "").strip() or "Vehicle"
            self._data = {CONF_DEVICE_ID: device_id, CONF_NAME: name}
            return await self.async_step_sensors()
        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_DEVICE_ID): DeviceSelector(
                        DeviceSelectorConfig(entity=EntityFilterSelectorConfig(domain="sensor"))
                    ),
                    vol.Optional(CONF_NAME): TextSelector(),
                }
            ),
        )

    async def async_step_sensors(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        detected = async_detect(self.hass, self._data[CONF_DEVICE_ID]) if user_input is None else {}
        return await _sensors_step(
            self, "sensors", user_input, detected, {"name": self._data[CONF_NAME], "found": str(len(detected))}
        )

    async def async_step_prices(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            options = {**self._options, **_clean(user_input, _PRICE_KEYS), **_tuning({})}
            return self.async_create_entry(title=self._data[CONF_NAME], data=self._data, options=options)
        return self.async_show_form(
            step_id="prices",
            data_schema=_prices_schema(self.hass.config.currency, tuning=False),
            description_placeholders={"name": self._data[CONF_NAME]},
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return VehicleConsumptionOptionsFlow()


class VehicleConsumptionOptionsFlow(OptionsFlow):
    """Change the sensors and capacities, then the prices and the tuning."""

    def __init__(self) -> None:
        self._options: dict[str, Any] = {}

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        return await _sensors_step(self, "init", user_input, dict(self.config_entry.options))

    async def async_step_prices(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(
                data={**self._options, **_clean(user_input, _PRICE_KEYS), **_tuning(user_input)}
            )
        current = {**_tuning(dict(self.config_entry.options)), **self.config_entry.options}
        return self.async_show_form(
            step_id="prices",
            data_schema=self.add_suggested_values_to_schema(
                _prices_schema(self.hass.config.currency, tuning=True), current
            ),
        )

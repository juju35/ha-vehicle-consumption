"""Trips from a coarse fuel sensor (Renault: whole litres): short trips get an estimated use, months stay measured."""

from __future__ import annotations

from datetime import timedelta

from freezegun.api import FrozenDateTimeFactory
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import async_fire_time_changed

from custom_components.vehicle_consumption.const import (
    CONF_FUEL_PRICE,
    CONF_FUEL_QUANTITY,
    CONF_ODOMETER,
    CONF_TANK_CAPACITY,
    CONF_TRIP_GAP,
)

from .conftest import FUEL, KM, LITERS, ODOMETER, measured_trips, setup_vehicle, state_of

OPTIONS = {
    CONF_ODOMETER: ODOMETER,
    CONF_FUEL_QUANTITY: FUEL,
    CONF_TANK_CAPACITY: 55,
    CONF_TRIP_GAP: 30,
    CONF_FUEL_PRICE: 2.0,
}


async def _trip(hass: HomeAssistant, freezer: FrozenDateTimeFactory, odometer: float, fuel: str) -> None:
    """Drive to `odometer` km with the tank reading `fuel`, then park long enough for the trip to close."""
    hass.states.async_set(ODOMETER, str(odometer), KM)
    hass.states.async_set(FUEL, fuel, LITERS)
    await hass.async_block_till_done()
    freezer.tick(timedelta(minutes=40))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()


async def test_whole_litres_short_trips_are_estimated(hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> None:
    """The owner's Espace: 11 km gave 0 L (0 L/100 km, 0 €), 21 km gave 2 L (9.5 L/100 km)."""
    await setup_vehicle(hass, OPTIONS, states={ODOMETER: ("10000", KM), FUEL: ("50", LITERS)})
    await _trip(hass, freezer, 10300, "29")  # 300 km, 21 L: 7 L/100 km, measured (21 steps)
    await _trip(hass, freezer, 10311, "29")  # 11 km, no drop seen
    await _trip(hass, freezer, 10313, "28")  # 2 km, the whole litre
    await _trip(hass, freezer, 10334, "26")  # 21 km, 2 L

    attrs = state_of(hass, "consumption").attributes
    trips = [(t["distance"], t["fuel"], t["fuel_consumption"], t["cost"], t["estimated"]) for t in attrs["trips"]]
    # The 300 km of the period: 24 L over 334 km once all are in, 7.19 L/100 km.
    assert trips == [
        (21.0, 1.51, 7.2, 3.02, True),
        (2.0, 0.14, None, 0.29, True),
        (11.0, 0.79, 7.2, 1.58, True),
        (300.0, 21.0, 7.0, 42.0, False),
    ]
    # Stored as measured, and the month and total stay the sums of what the sensor showed.
    assert measured_trips(hass) == [(21, 2), (2, 1), (11, 0), (300, 21)]
    assert attrs["month"]["fuel"] == 24 and attrs["total"]["fuel"] == 24 and attrs["total"]["cost"] == 48
    # The trip sensors follow the estimate.
    assert float(state_of(hass, "fuel_consumption_trip").state) == 7.2


async def test_fine_sensor_trips_stay_measured(hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> None:
    """A sensor in hundredths of a litre measures a short trip well: nothing is estimated."""
    await setup_vehicle(hass, OPTIONS, states={ODOMETER: ("10000", KM), FUEL: ("50.25", LITERS)})
    await _trip(hass, freezer, 10300, "29.25")
    await _trip(hass, freezer, 10311, "28.43")
    attrs = state_of(hass, "consumption").attributes
    assert [(t["fuel"], t["estimated"]) for t in attrs["trips"]] == [(0.82, False), (21.0, False)]

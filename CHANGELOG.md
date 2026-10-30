# Changelog

## 0.1.0

First public release.

### What's new
- Vehicle Consumption integration: one entry per vehicle, set up from its device. The odometer and the fuel and battery sensors are detected automatically (Renault first-class, and Tesla/Teslemetry, Kia/Hyundai, Volkswagen, BMW, Mercedes-Benz, Toyota, Peugeot/Citroën/DS/Opel, Volvo, Polestar, Ford, Skoda, OBD-II dongles…), or picked by hand; miles, US gallons and Wh are converted.
- Fuel, electric and plug-in hybrid vehicles: fuel used (L) and energy used (kWh) are worked out from the level changes, refuels and charges are detected on their own, small level jitters are ignored.
- Trips: each trip starts when the odometer moves and ends after a gap without driving (30 minutes by default), with its distance, consumption and cost.
- Consumption in L/100 km and kWh/100 km for the last trip, the current month and on average; distance, fuel and energy used and cost of the month; cost per km; last refuel and last charge. Prices from a sensor (such as [ha-carburants-france](https://github.com/juju35/ha-carburants-france)) or fixed.
- History kept across restarts: the last 24 months, 20 trips, 20 refuels and 20 charges.
- `vehicle_consumption.add_refuel` and `vehicle_consumption.add_charge` actions to log a refuel or a charge by hand (from an automation, say), and `vehicle_consumption.reset_statistics`.
- Vehicle Consumption card, bundled with the integration and added to the dashboard resources automatically: fuel and battery gauges, trip / month / average / cost per km tiles, monthly chart of consumption, distance or cost, recent trips and refuels or charges, a dot while driving, and a popup to log a refuel or a charge; visual editor.
- English, French, German and Spanish.

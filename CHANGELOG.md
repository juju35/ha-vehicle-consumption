# Changelog

## 0.2.0

### What's new
- History import: when a vehicle is added, the trips, refuels, charges and months are rebuilt from what the recorder kept of its sensors (10 days by default), at the prices of then when a price sensor is used. The new `vehicle_consumption.import_history` action does it again on demand; refuels and charges logged by hand are kept. A vehicle added with 0.1.0 is imported once after the update.

## 0.1.0

First public release.

### What's new
- Vehicle Consumption integration: one entry per vehicle, set up from its device. The odometer and the fuel and battery sensors are detected automatically from the sensor keys of 26 integrations (Renault, Tesla Fleet, Teslemetry, Tessie, Kia/Hyundai, BMW Connected Drive, BMW CarData, BavarianData, MercedesME, Toyota, Volvo, Volvo Cars, Polestar, Volkswagen Car-Net, Volkswagen We Connect ID, Audi connect, MySkoda, SEAT Connect, CUPRA We Connect, Stellantis, FordPass, Nissan Leaf, MG SAIC, BYD, WiCAN, OVMS), from their names and units for any other vehicle, or picked by hand; miles, metres, US gallons, Wh, kJ and MJ are converted.
- Fuel, electric and plug-in hybrid vehicles: fuel used (L) and energy used (kWh) are worked out from the level changes, refuels and charges are detected on their own, small level jitters are ignored.
- Trips: each trip starts when the odometer moves and ends after a gap without driving (30 minutes by default), with its distance, consumption and cost.
- Consumption in L/100 km and kWh/100 km for the last trip, the current month and on average; distance, fuel and energy used and cost of the month; cost per km; last refuel and last charge. Prices from a sensor (such as [ha-carburants-france](https://github.com/juju35/ha-carburants-france)) or fixed.
- Home charger support: the energy counter of an evcc, Easee, Zaptec, Wallbox or Ohme charger (or any energy sensor) is detected and measures home charges at the charger, losses included; total and session counters both work, and a home charge is never counted twice with the battery rise. Charges away from home are still detected from the battery.
- History kept across restarts: the last 24 months, 20 trips, 20 refuels and 20 charges.
- `vehicle_consumption.add_refuel` and `vehicle_consumption.add_charge` actions to log a refuel or a charge by hand (from an automation, say), and `vehicle_consumption.reset_statistics`.
- Vehicle Consumption card, bundled with the integration and added to the dashboard resources automatically: fuel and battery gauges, trip / month / average / cost per km tiles, monthly chart of consumption, distance or cost, recent trips and refuels or charges, a dot while driving, and a popup to log a refuel or a charge; visual editor that lists your vehicles automatically.
- English, French, German and Spanish.

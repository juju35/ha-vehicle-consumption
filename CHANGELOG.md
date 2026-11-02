# Changelog

## 0.2.5 - 2026-11-01

### Fixes
- History import no longer wipes what was tracked. With the vehicle's sensors excluded from the recorder (or nothing recorded for them), the one-off re-import after updating from 0.2.0 / 0.2.1 reset the totals, months and trips to zero; it now leaves them as they are. When the recorder starts after the tracking did (and with the `import_history` action over a few `days`), the months it does not cover from their first day keep their figures, trips, refuels and charges, and the total adds them up.
- History import (the one-off re-import and the `import_history` action) never replaces tracked figures with a partial history either: it changes nothing when the odometer or a fuel / battery sensor has no usable recorded reading (excluded from the recorder, only `unavailable`, new or just changed) or is no longer recorded; it only replays the months that every counting source covers from their first day, also when one of them was recorded from before the tracking started; and when the replay still has less distance, fuel, energy or cost than tracked (a gap in the recorder, or a price sensor excluded from the recorder and not available yet: no cost), everything stays as tracked and a warning is logged.
- History import from the hourly statistics (beyond the 10 days of recorded states, or with the `import_history` action) no longer counts the last hour of a month twice when that month keeps its tracked figures and the next one is replayed: a drive on the last evening of the month was added to both months, and its trip listed twice.
- History import never shortens the trip being driven: when a sensor was recorded only from the middle of it (Home Assistant restarted during the drive), the trip keeps its start and distance as tracked.
- Setup: the sensors step says "Sensors found automatically: 2" instead of "1 sensors were found".
- Card: on a narrow column, the vehicle name stays visible: the average consumption pill keeps its whole value while it fits, then tightens the header spacing, then shows only its coloured dot (the value stays in its tooltip), never a cut value: the fit is measured on the value itself, so a kWh/100 km value or a driving title also keeps it whole as long as there is room, and a wider card never shows less than a narrower one. The card now takes at least 8 of the 12 columns of a section (6 cut the values on a phone). The KPI tiles put the unit under the value and wrap long labels instead of cutting them.
- Card: the trips of a plug-in hybrid show one consumption a line, so the date and distance no longer disappear and the values no longer overflow the card.
- Card: the monthly chart is drawn at the card's width, so its month names and values keep a readable size on a narrow card. It is redrawn at the next frame after a resize, so the browser no longer logs "ResizeObserver loop completed with undelivered notifications" at each load.
- Card: coloured texts (the average pill, a low tank or battery, refuels logged by hand, the current month of the chart, the add popup) are darker in light themes and lighter in dark ones, for a readable contrast.
- Card: an unavailable sensor (Home Assistant starting, the integration reloading) or a wrong `entity` now says so, with the sensor, instead of "Not set up", also when the card picks the vehicle on its own (no `entity`).
- Card: in a layout-card, a grid card column sized `auto` or any parent sized by its content, the card no longer collapses to a thin strip, and it still shrinks in a `1fr` column without overflowing, also when a wrapper (a `div`, the dashboard's card container) sits between the grid and the card.
- Card: opening the refuel / charge popup puts the cursor in the amount without scrolling the dashboard.
- Card: the trips, refuels and charges counters read "5/6" when only the last 5 rows are listed.
- Card: times follow Home Assistant's 12 / 24-hour setting.
- Card editor: "Chart shows" and "Months in the chart" are hidden while the chart is turned off.

## 0.2.4 - 2026-11-01

### What's new
- Added Italian, Dutch, European Portuguese and Polish translations: `it`, `nl`, `pt` and `pl` for the setup and options, the entities, the actions and the card with its visual editor. Brazilian Portuguese: `pt-BR` uses the European Portuguese texts, in the integration as in the card.

### Changes
- Card: the header badge is now a gauge (`mdi:gauge-low`), the icon of the projects site, for every vehicle; its colour still follows the state (driving, low level, not available). It replaced a car icon that changed with the vehicle type.

## 0.2.3 - 2026-11-01

### What's new
- Added Serbian (Cyrillic and Latin) translations: `sr` and `sr-Latn` for the setup and options, the entities, the actions and the card with its visual editor. The card follows Home Assistant's language (Serbian in Latin script when Home Assistant is set to `sr-Latn`) or its `language` option; month names follow the script.

## 0.2.2

### Fixes
- History import: a fuel or battery level in % set next to the fuel quantity or battery energy sensor (the default for Renault, Tesla, Kia, Stellantis, MG, BMW and others) no longer adds fake refuels or charges and inflates the consumption. The level is now only shown, the quantity does the counting, and a level without statistics no longer prevents the hourly replay.
- The same sensor can no longer be picked for two sources (such as the fuel quantity and the fuel level); a vehicle already set up that way shows the level from the quantity correctly.
- Vehicles imported with 0.2.0 or 0.2.1 have their history imported again once after the update, so the fixes of 0.2.1 and 0.2.2 apply to it; refuels and charges logged by hand are kept.
- The fuel or battery level shown on the card now follows its sensor when only the level changes.

## 0.2.1

### Fixes
- History import: trips found in the hourly statistics no longer show 0.0 L/100 km (or kWh/100 km) when the fuel or battery level is a sensor in % (Tesla, Kia, Toyota, Volkswagen, Renault battery and most others). Its hourly mean is now used, and the hours are only replayed once the odometer and every fuel or battery sensor have statistics, so a level without statistics no longer leaves trips with nothing used.
- History import: a price sensor that did not change during the imported days now prices them (its value when the period starts, else the first one recorded); the trips, months and refuels of the import were left without a cost, or at the fixed price. The hourly mean of a price sensor is used before the recorded states too.

## 0.2.0

### What's new
- History import: when a vehicle is added, the trips, refuels, charges and months of the last 60 days are rebuilt from what Home Assistant recorded of its sensors: the recorded states where the recorder still has them (10 days by default), the hourly long-term statistics before, at the prices of then when a price sensor is used. The new `vehicle_consumption.import_history` action does it again on demand, over the number of days you choose (up to 730); refuels and charges logged by hand are kept. A vehicle added with 0.1.0 is imported once after the update.

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

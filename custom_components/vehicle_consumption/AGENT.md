# Vehicle Consumption — Agent Context

## Purpose
Home Assistant custom integration that works out the fuel and electricity consumption of a vehicle (L/100 km, kWh/100 km), its trips, months, costs, refuels and charges from the sensors of its own integration (Renault, Tesla, Kia, Volkswagen, OBD…): odometer, fuel quantity / level, battery energy / level. One config entry per vehicle. It bundles a Lovelace card.

## Architecture

```
custom_components/vehicle_consumption/
├── __init__.py      # Static path + dashboard resource for the card, actions add_refuel / add_charge / reset_statistics, entry setup
├── tracker.py       # ConsumptionTracker: levels → consumption / refuels / charges, odometer → distance / trips, months, costs (.storage)
├── detect.py        # async_detect(hass, device_id): exact keys of 26 integrations (_KNOWN), then keyword + unit + device class matching for any brand
├── charger.py       # async_detect_charger(hass): home charger energy counter (evcc, Easee, Zaptec, Wallbox, Ohme) in the whole registry
├── config_flow.py   # user (device + name) → sensors (prefilled by async_detect + async_detect_charger) → prices; options: init (sensors) → prices (+ trip_gap, thresholds)
├── sensor.py        # consumption (card data in attributes) + trip / month / average figures, costs, last_refuel / last_charge
├── entity.py        # Shared service device (name = vehicle), listener on the tracker
├── frontend/vehicle-consumption-card.js   # custom:vehicle-consumption-card, reads the consumption sensor attributes
├── const.py / icons.json / services.yaml / translations/{en,fr,de,es}.json / brand/
```

## Rules
- Entry: `data` = `device_id`, `name` (unique ID = device ID, title = name); `options` = sensors, capacities, prices, `trip_gap` (min), `refuel_threshold` (L), `charge_threshold` (kWh). Options changes reload the entry.
- Units are normalised on read: `mi` → km, US `gal` → L, `Wh` → kWh. A fuel / battery level (%) becomes L / kWh with the capacity, and only when no quantity / energy sensor is set (config-flow errors `tank_capacity_required`, `battery_capacity_required`; `no_energy_sensor` without any of the four).
- Kind: `fuel`, `electric`, or `plugin_hybrid` (both). The main sensor shows fuel L/100 km when fuel is tracked, else kWh/100 km. Fuel / energy entities exist only for the tracked kind.
- Levels: a drop is consumption (`ref - new`, new ref); a rise ≥ threshold is a refuel / charge (new ref); a smaller rise is noise (ref unchanged, nothing counted twice). Rises with nothing consumed in between, within 12 h, are merged into one event (charging reported step by step). `unknown` / `unavailable` / non-numeric states are ignored.
- Home charger (`charger_energy`, optional, only with a battery sensor: config-flow error `charger_needs_battery`, ignored by the tracker otherwise): a session is the counter going up until it has not moved for `CHARGER_SESSION_GAP` (30 min, closed by the 1-min tick and at load); amount = counter delta (Wh → kWh; a counter going down is a session counter back to 0, counted from 0; a step > `MAX_CHARGER_STEP` is ignored), cost = amount × current electricity price; recorded in `charges` with `source: "charger"` (and `start`) once ≥ the charge threshold, updated in place while the session goes on. A battery rise whose span (previous battery reading → rise, ± `CHARGER_OVERLAP` 10 min) saw the counter move is not recorded (and `auto` rises recorded just before the session started are dropped): no double counting. Rises while the charger is idle stay `auto` (charged away). Consumption still comes from the battery drops. Store keys `charger` and `<kind>.seen`, missing in older stores → defaults. Charger sensors and keys are listed in `charger.py` (`CHARGER_SENSORS`, with their source files); vehicle sensors stay in `detect.py`.
- Odometer: only positive deltas count; a jump > 2000 km resets the reference without counting; a step back keeps the highest reading. A trip opens on the first move and closes `trip_gap` minutes after the last one (1-min timer; also checked at load, so a trip open across a restart closes). Trip figures = deltas of the totals between start and end.
- Cost is counted when fuel / energy is consumed, at the current price: price entity numeric state (per gal → per L, per MWh → per kWh) wins over the fixed price; none → cost stays None.
- Consumption figures and cost per km are None under 5 km. Rounding: distance 1, L/kWh 2, consumption 1, cost 2, cost_per_km 3 decimals.
- Months keyed `YYYY-MM` in local time (24 kept, the current one always listed); trips and refuels / charges keep 20, newest first. Month sensors are `TOTAL` with `last_reset` = first of the month and go back to zero at the month change even when parked.
- Manual events (`add_refuel` / `add_charge`, source `manual`) only fill the lists: consumption comes from the sensors. Cost and price complete each other; neither → current price. `reset_statistics` clears everything and restarts from the current readings. Unknown entry → `entry_not_found`, not loaded → `not_loaded` (translated `ServiceValidationError`).
- Storage: `.storage/vehicle_consumption.<entry_id>` (delayed save 10 s, immediate save on unload, deleted with the entry). Unreadable data is logged and tracking starts afresh. On load the current readings are applied, catching up what changed while stopped.
- Main sensor attributes (the card relies on the exact keys): `vehicle, entry_id, kind, currency, odometer, fuel_quantity, fuel_level, tank_capacity, battery_energy, battery_level, battery_capacity, fuel_price, electricity_price, driving, trip, month, total, months, trips, refuels, charges`. `months`, `trips`, `refuels`, `charges` are unrecorded.
- The card is served at `/vehicle_consumption/vehicle-consumption-card.js` and added to the dashboard resources (storage mode) or loaded with `add_extra_js_url` (YAML mode); removed with the last entry. `_storage_resources()` reads `hass.data["lovelace"]` as a dict (before 2025.2) or a dataclass (`mode`, then `resource_mode` from 2026.2).
- Entity IDs follow the translated names: tests look sensors up by unique ID `<entry_id>_<key>` (`tests/conftest.py`, `state_of`).
- Minimum Home Assistant 2024.12.0 (`OptionsFlow.config_entry`).

## Release
Bump the version in `manifest.json`, `const.py` (`VERSION`) and the card (`VEHICLE_CONSUMPTION_CARD_VERSION`), add its CHANGELOG.md section.

## Tests
`pip install -r requirements_test.txt && pytest` — vehicle devices and their sensors are registry entities on mock config entries (`tests/conftest.py`), time is moved with `freezer`. An autouse fixture (`no_deprecated_calls`) fails any test during which Home Assistant reports a deprecated call naming `vehicle_consumption`.
- Vehicle detection (`detect.py`): `_KNOWN[platform][source]` lists the integration's sensor keys, preferred first, read from its source code. A sensor matches by translation key, or by unique ID suffix after `_ - . /` (lower case; `~key` = anywhere in the unique ID, for OVMS topic paths); the longest matching key wins (`phev_usable_battery_level` vs `battery_level`). `_TRANSLATION_KEY_ONLY` platforms never match on unique IDs (their short keys end other sensors' IDs). `tests/test_config_flow.py::test_known_integration_keys` checks every key of every platform. Units: `_UNIT_FACTORS` in tracker.py (mi/m → km, gal → L, Wh/MWh/kJ/MJ → kWh).
- History import (`ConsumptionTracker.async_import_history`): reads `get_significant_states` (all changes, attributes) of the source and price sensors over `HISTORY_MAX_AGE`, resets, and replays them sorted by `last_updated` through `_process`, running the tick's trip / charger closing before each state; price entities use their recorded state (`_replay_prices`) instead of the current one. Manual events survive. Runs once per entry in a background task after start (`history_imported` in the store, so a 0.1.0 entry is imported once after the update), and on the `import_history` action (`no_recorder` error without the recorder).

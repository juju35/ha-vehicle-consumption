"""Render the Vehicle Consumption card with mock vehicles and save the README screenshots.

Usage: python scripts/screenshots.py  (needs `pip install playwright` and `playwright install chromium`, and ffmpeg for
the GIFs). CHROMIUM_PATH=/path/to/chrome to use another browser. The clock is frozen so the dates stay the same.
Every capture keeps a 16 px frame of the theme background around the card.
"""

import json
import os
import subprocess
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
CARD_JS = (ROOT / "custom_components/vehicle_consumption/frontend/vehicle-consumption-card.js").read_text()
NOW = "2026-10-30T18:00:00+01:00"
WIDTH = 460
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")

THEMES = {
    "light": {
        "--primary-background-color": "#e8eaed",
        "--secondary-background-color": "#f1f2f4",
        "--card-background-color": "#ffffff",
        "--primary-text-color": "#212121",
        "--secondary-text-color": "#727272",
        "--divider-color": "rgba(0,0,0,.12)",
    },
    "dark": {
        "--primary-background-color": "#111111",
        "--secondary-background-color": "#262626",
        "--card-background-color": "#1c1c1c",
        "--primary-text-color": "#e1e1e1",
        "--secondary-text-color": "#9b9b9b",
        "--divider-color": "rgba(225,225,225,.12)",
    },
}
COMMON = {
    "--primary-color": "#03a9f4",
    "--success-color": "#43a047",
    "--warning-color": "#ffa600",
    "--error-color": "#db4437",
    "--text-primary-color": "#ffffff",
}

# Material Design Icons paths used by the card (from @mdi/js).
ICONS = {
    "car": "M5,11L6.5,6.5H17.5L19,11M17.5,16A1.5,1.5 0 0,1 16,14.5A1.5,1.5 0 0,1 17.5,13A1.5,1.5 0 0,1 19,14.5A1.5,1.5 0 0,1 17.5,16M6.5,16A1.5,1.5 0 0,1 5,14.5A1.5,1.5 0 0,1 6.5,13A1.5,1.5 0 0,1 8,14.5A1.5,1.5 0 0,1 6.5,16M18.92,6C18.72,5.42 18.16,5 17.5,5H6.5C5.84,5 5.28,5.42 5.08,6L3,12V20A1,1 0 0,0 4,21H5A1,1 0 0,0 6,20V19H18V20A1,1 0 0,0 19,21H20A1,1 0 0,0 21,20V12L18.92,6Z",
    "car-electric": "M18.92 2C18.72 1.42 18.16 1 17.5 1H6.5C5.84 1 5.29 1.42 5.08 2L3 8V16C3 16.55 3.45 17 4 17H5C5.55 17 6 16.55 6 16V15H18V16C18 16.55 18.45 17 19 17H20C20.55 17 21 16.55 21 16V8L18.92 2M6.5 12C5.67 12 5 11.33 5 10.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12M17.5 12C16.67 12 16 11.33 16 10.5S16.67 9 17.5 9 19 9.67 19 10.5 18.33 12 17.5 12M5 7L6.5 2.5H17.5L19 7H5M7 20H11V18L17 21H13V23L7 20Z",
    "car-electric-outline": "M18.92 2C18.72 1.42 18.16 1 17.5 1H6.5C5.84 1 5.29 1.42 5.08 2L3 8V16C3 16.55 3.45 17 4 17H5C5.55 17 6 16.55 6 16V15H18V16C18 16.55 18.45 17 19 17H20C20.55 17 21 16.55 21 16V8L18.92 2M6.85 3H17.14L18.22 6.11H5.77L6.85 3M19 13H5V8H19V13M7.5 9C8.33 9 9 9.67 9 10.5S8.33 12 7.5 12 6 11.33 6 10.5 6.67 9 7.5 9M16.5 9C17.33 9 18 9.67 18 10.5S17.33 12 16.5 12C15.67 12 15 11.33 15 10.5S15.67 9 16.5 9M7 20H11V18L17 21H13V23L7 20Z",
    "car-off": "M20.5,19.85L6.41,5.76L2.41,1.76L1.11,3L4.57,6.46L3,11V19A1,1 0 0,0 4,20H5A1,1 0 0,0 6,19V18H16.11L20.84,22.73L22.11,21.46L20.5,19.85M6.5,15A1.5,1.5 0 0,1 5,13.5A1.5,1.5 0 0,1 6.5,12A1.5,1.5 0 0,1 8,13.5A1.5,1.5 0 0,1 6.5,15M5,10L5.78,7.67L8.11,10H5M17.5,5.5L19,10H13.2L16.12,12.92C16.5,12.17 17.37,11.86 18.12,12.21C18.87,12.57 19.18,13.47 18.83,14.21C18.68,14.5 18.43,14.77 18.12,14.92L21,17.8V11L18.92,5C18.71,4.4 18.14,4 17.5,4H7.2L8.7,5.5H17.5Z",
    "plus": "M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z",
    "gas-station": "M18,10A1,1 0 0,1 17,9A1,1 0 0,1 18,8A1,1 0 0,1 19,9A1,1 0 0,1 18,10M12,10H6V5H12M19.77,7.23L19.78,7.22L16.06,3.5L15,4.56L17.11,6.67C16.17,7 15.5,7.93 15.5,9A2.5,2.5 0 0,0 18,11.5C18.36,11.5 18.69,11.42 19,11.29V18.5A1,1 0 0,1 18,19.5A1,1 0 0,1 17,18.5V14C17,12.89 16.1,12 15,12H14V5C14,3.89 13.1,3 12,3H6C4.89,3 4,3.89 4,5V21H14V13.5H15.5V18.5A2.5,2.5 0 0,0 18,21A2.5,2.5 0 0,0 20.5,18.5V9C20.5,8.31 20.22,7.68 19.77,7.23Z",
    "battery-charging-medium": "M12 20H4V6H12M12.67 4H11V2H5V4H3.33C2.6 4 2 4.6 2 5.33V20.67C2 21.4 2.6 22 3.33 22H12.67C13.41 22 14 21.41 14 20.67V5.33C14 4.6 13.4 4 12.67 4M11 16H5V19H11V16M11 11.5H5V14.5H11V11.5M23 10H20V3L15 13H18V21",
    "map-marker-distance": "M6.5,8.11C5.61,8.11 4.89,7.39 4.89,6.5A1.61,1.61 0 0,1 6.5,4.89C7.39,4.89 8.11,5.61 8.11,6.5V6.5A1.61,1.61 0 0,1 6.5,8.11M6.5,2C4,2 2,4 2,6.5C2,9.87 6.5,14.86 6.5,14.86C6.5,14.86 11,9.87 11,6.5C11,4 9,2 6.5,2M17.5,8.11A1.61,1.61 0 0,1 15.89,6.5C15.89,5.61 16.61,4.89 17.5,4.89C18.39,4.89 19.11,5.61 19.11,6.5A1.61,1.61 0 0,1 17.5,8.11M17.5,2C15,2 13,4 13,6.5C13,9.87 17.5,14.86 17.5,14.86C17.5,14.86 22,9.87 22,6.5C22,4 20,2 17.5,2M17.5,16C16.23,16 15.1,16.8 14.68,18H9.32C8.77,16.44 7.05,15.62 5.5,16.17C3.93,16.72 3.11,18.44 3.66,20C4.22,21.56 5.93,22.38 7.5,21.83C8.35,21.53 9,20.85 9.32,20H14.69C15.24,21.56 16.96,22.38 18.5,21.83C20.08,21.28 20.9,19.56 20.35,18C19.92,16.8 18.78,16 17.5,16V16M17.5,20.5A1.5,1.5 0 0,1 16,19A1.5,1.5 0 0,1 17.5,17.5A1.5,1.5 0 0,1 19,19A1.5,1.5 0 0,1 17.5,20.5Z",
    "calendar-month-outline": "M7 11H9V13H7V11M21 5V19C21 20.11 20.11 21 19 21H5C3.89 21 3 20.1 3 19V5C3 3.9 3.9 3 5 3H6V1H8V3H16V1H18V3H19C20.11 3 21 3.9 21 5M5 7H19V5H5V7M19 19V9H5V19H19M15 13V11H17V13H15M11 13V11H13V13H11M7 15H9V17H7V15M15 17V15H17V17H15M11 17V15H13V17H11Z",
    "chart-line": "M16,11.78L20.24,4.45L21.97,5.45L16.74,14.5L10.23,10.75L5.46,19H22V21H2V3H4V17.54L9.5,8L16,11.78Z",
    "cash": "M3,6H21V18H3V6M12,9A3,3 0 0,1 15,12A3,3 0 0,1 12,15A3,3 0 0,1 9,12A3,3 0 0,1 12,9M7,8A2,2 0 0,1 5,10V14A2,2 0 0,1 7,16H17A2,2 0 0,1 19,14V10A2,2 0 0,1 17,8H7Z",
    "chevron-right": "M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z",
    "map-marker-path": "M18,15A3,3 0 0,1 21,18A3,3 0 0,1 18,21C16.69,21 15.58,20.17 15.17,19H14V17H15.17C15.58,15.83 16.69,15 18,15M18,17A1,1 0 0,0 17,18A1,1 0 0,0 18,19A1,1 0 0,0 19,18A1,1 0 0,0 18,17M18,8A1.43,1.43 0 0,0 19.43,6.57C19.43,5.78 18.79,5.14 18,5.14C17.21,5.14 16.57,5.78 16.57,6.57A1.43,1.43 0 0,0 18,8M18,2.57A4,4 0 0,1 22,6.57C22,9.56 18,14 18,14C18,14 14,9.56 14,6.57A4,4 0 0,1 18,2.57M8.83,17H10V19H8.83C8.42,20.17 7.31,21 6,21A3,3 0 0,1 3,18C3,16.69 3.83,15.58 5,15.17V14H7V15.17C7.85,15.47 8.53,16.15 8.83,17M6,17A1,1 0 0,0 5,18A1,1 0 0,0 6,19A1,1 0 0,0 7,18A1,1 0 0,0 6,17M6,3A3,3 0 0,1 9,6C9,7.31 8.17,8.42 7,8.83V10H5V8.83C3.83,8.42 3,7.31 3,6A3,3 0 0,1 6,3M6,5A1,1 0 0,0 5,6A1,1 0 0,0 6,7A1,1 0 0,0 7,6A1,1 0 0,0 6,5M11,19V17H13V19H11M7,13H5V11H7V13Z",
    "ev-station": "M19.77,7.23L19.78,7.22L16.06,3.5L15,4.56L17.11,6.67C16.17,7.03 15.5,7.93 15.5,9A2.5,2.5 0 0,0 18,11.5C18.36,11.5 18.69,11.42 19,11.29V18.5A1,1 0 0,1 18,19.5A1,1 0 0,1 17,18.5V14A2,2 0 0,0 15,12H14V5A2,2 0 0,0 12,3H6A2,2 0 0,0 4,5V21H14V13.5H15.5V18.5A2.5,2.5 0 0,0 18,21A2.5,2.5 0 0,0 20.5,18.5V9C20.5,8.31 20.22,7.68 19.77,7.23M18,10A1,1 0 0,1 17,9A1,1 0 0,1 18,8A1,1 0 0,1 19,9A1,1 0 0,1 18,10M8,18V13.5H6L10,6V11H12L8,18Z",
    "close": "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z",
}

# Minimal stand-ins for Home Assistant's <ha-card> and <ha-icon>.
HA_ELEMENTS = (
    "const ICONS = "
    + json.dumps(ICONS)
    + ";"
    + """
customElements.define("ha-card", class extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" }).innerHTML =
      "<style>:host{display:block;background:var(--card-background-color);border-radius:12px;" +
      "border:1px solid var(--divider-color);color:var(--primary-text-color);overflow:hidden}</style><slot></slot>";
  }
});
customElements.define("ha-icon", class extends HTMLElement {
  static get observedAttributes() { return ["icon"]; }
  connectedCallback() { this._draw(); }
  attributeChangedCallback() { this._draw(); }
  _draw() {
    const path = ICONS[(this.getAttribute("icon") || "").replace("mdi:", "")] || "";
    this.style.display = "inline-flex";
    this.innerHTML = '<svg viewBox="0 0 24 24" style="width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px);fill:currentColor"><path d="' + path + '"/></svg>';
  }
});"""
)

MONTHS = [f"2025-{m:02d}" for m in (11, 12)] + [f"2026-{m:02d}" for m in range(1, 11)]
# Monthly distance (km) of each vehicle; the EV was off the road in February (no data that month).
DISTANCE = [640, 910, 720, 0, 805, 760, 1180, 1420, 2210, 690, 830, 812]
FUEL_CONS = [6.3, 6.6, 6.4, None, 6.0, 5.8, 5.6, 5.7, 5.5, 5.8, 6.0, 5.9]
EV_CONS = [17.8, 19.4, 18.9, None, 16.3, 15.2, 14.6, 14.1, 14.8, 15.1, 15.9, 16.2]
FUEL_PRICE = 1.82
KWH_PRICE = 0.25


def r(value, digits):
    return None if value is None else round(value, digits)


def amounts(km, fuel, energy, cost):
    """The distance, amounts, consumptions and cost of a month or a trip, rounded like the integration."""
    return {
        "distance": float(km),
        "fuel": r(fuel, 2),
        "energy": r(energy, 2),
        "fuel_consumption": r(fuel and fuel / km * 100, 1),
        "energy_consumption": r(energy and energy / km * 100, 1),
        "cost": r(cost, 2),
        "cost_per_km": r(cost / km, 3),
    }


def month_rows(kind):
    rows = []
    for month, km, fc, ec in zip(MONTHS, DISTANCE, FUEL_CONS, EV_CONS, strict=True):
        if not km:
            continue
        fuel = km * fc / 100 if kind != "electric" else None
        energy = km * ec / 100 if kind == "electric" else None
        if kind == "plugin_hybrid":
            fuel, energy = km * fc * 0.45 / 100, km * ec * 0.6 / 100
        cost = (fuel or 0) * FUEL_PRICE + (energy or 0) * KWH_PRICE
        rows.append({"month": month, **amounts(km, fuel, energy, cost)})
    return rows


def totals(rows):
    km = sum(m["distance"] for m in rows)
    fuel = sum(m["fuel"] or 0 for m in rows)
    energy = sum(m["energy"] or 0 for m in rows)
    cost = sum(m["cost"] for m in rows)
    return {
        "since": "2025-11-02T09:12:00+01:00",
        "distance": round(km, 1),
        "fuel": r(fuel or None, 2),
        "energy": r(energy or None, 2),
        "fuel_consumption": r(fuel and fuel / km * 100, 1),
        "energy_consumption": r(energy and energy / km * 100, 1),
        "cost": round(cost, 2),
        "cost_per_km": round(cost / km, 3),
    }


# Recent trips: (start, minutes, km, L/100 km or None, kWh/100 km or None)
TRIPS = [
    ("2026-10-30T17:05:00+01:00", 38, 42.3, 5.6, 15.4),
    ("2026-10-30T08:10:00+01:00", 35, 41.8, 6.1, 16.8),
    ("2026-10-29T12:30:00+01:00", 14, 7.4, 7.9, 19.2),
    ("2026-10-28T18:20:00+01:00", 52, 64.0, 5.2, 14.9),
    ("2026-10-27T09:00:00+01:00", 22, 15.1, 6.8, 17.6),
    ("2026-10-25T14:00:00+02:00", 95, 128.6, 5.4, 15.8),
]


def trip_rows(kind):
    out = []
    for start, _minutes, km, fc, ec in TRIPS:
        fuel = km * fc / 100 if kind != "electric" else None
        energy = km * ec / 100 if kind != "fuel" else None
        if kind == "plugin_hybrid":
            fuel, energy = fuel * 0.4, energy * 0.6
        cost = (fuel or 0) * FUEL_PRICE + (energy or 0) * KWH_PRICE
        out.append({"start": start, "end": start, **amounts(km, fuel, energy, cost)})
    return out


REFUELS = [
    {
        "time": "2026-10-28T19:05:00+01:00",
        "odometer": 48168,
        "liters": 41.2,
        "cost": 74.98,
        "price": 1.82,
        "source": "auto",
    },
    {
        "time": "2026-10-12T08:40:00+02:00",
        "odometer": 47530,
        "liters": 38.6,
        "cost": 71.02,
        "price": 1.84,
        "source": "manual",
    },
    {
        "time": "2026-09-27T17:15:00+02:00",
        "odometer": 46890,
        "liters": 44.0,
        "cost": 79.64,
        "price": 1.81,
        "source": "auto",
    },
    {
        "time": "2026-09-08T12:10:00+02:00",
        "odometer": 46120,
        "liters": 39.5,
        "cost": 72.29,
        "price": 1.83,
        "source": "auto",
    },
]
CHARGES = [
    {
        "time": "2026-10-29T22:10:00+01:00",
        "odometer": 21410,
        "energy": 31.4,
        "cost": 7.85,
        "price": 0.25,
        "source": "auto",
    },
    {
        "time": "2026-10-26T21:30:00+01:00",
        "odometer": 21205,
        "energy": 28.2,
        "cost": 7.05,
        "price": 0.25,
        "source": "auto",
    },
    {
        "time": "2026-10-21T13:00:00+02:00",
        "odometer": 20980,
        "energy": 42.0,
        "cost": 16.80,
        "price": 0.40,
        "source": "manual",
    },
]


def attributes(kind, **extra):
    rows = month_rows(kind)
    trips = trip_rows(kind)
    ev = kind == "electric"
    hybrid = kind == "plugin_hybrid"
    return {
        "vehicle": "City EV" if ev else "Family car",
        "entry_id": "01JCAR0000000000000000",
        "kind": kind,
        "currency": "EUR",
        "odometer": 21480.6 if ev else 48210.4,
        "fuel_quantity": None if ev else (22.6 if hybrid else 31.5),
        "fuel_level": None if ev else (56.5 if hybrid else 63.0),
        "tank_capacity": None if ev else (40.0 if hybrid else 50.0),
        "battery_energy": 38.4 if ev else (7.1 if hybrid else None),
        "battery_level": 72.0 if ev else (68.0 if hybrid else None),
        "battery_capacity": 52.0 if ev else (10.4 if hybrid else None),
        "fuel_price": None if ev else FUEL_PRICE,
        "electricity_price": KWH_PRICE if ev or hybrid else None,
        "driving": False,
        "trip": trips[0],
        "month": rows[-1],
        "total": totals(rows),
        "months": rows,
        "trips": trips,
        "refuels": [] if ev else REFUELS,
        "charges": CHARGES if ev or hybrid else [],
        **extra,
    }


def mock_hass(kind, **extra):
    sensor = "sensor.city_ev_consumption" if kind == "electric" else "sensor.family_car_consumption"
    attrs = attributes(kind, **extra)
    primary = "energy" if kind == "electric" else "fuel"
    unit = "kWh/100 km" if kind == "electric" else "L/100 km"
    return {
        "states": {
            sensor: {
                "entity_id": sensor,
                "state": str(attrs["total"][f"{primary}_consumption"]),
                "attributes": {
                    "unit_of_measurement": unit,
                    "friendly_name": f"{attrs['vehicle']} Consumption",
                    **attrs,
                },
            },
        },
        "entities": {sensor: {"entity_id": sensor, "platform": "vehicle_consumption", "device_id": "car"}},
        "devices": {},
        "areas": {},
        "language": "en",
        "locale": {"language": "en", "number_format": "language"},
        "config": {"currency": "EUR"},
    }


SHOTS = [
    {"file": "card-fuel", "theme": "light", "kind": "fuel", "config": {}},
    {"file": "card-fuel-dark", "theme": "dark", "kind": "fuel", "config": {}},
    {"file": "card-ev", "theme": "light", "kind": "electric", "config": {}},
    {"file": "card-ev-dark", "theme": "dark", "kind": "electric", "config": {}},
    {"file": "card-hybrid", "theme": "light", "kind": "plugin_hybrid", "config": {"months": 12}},
    {
        "file": "card-sections",
        "theme": "light",
        "kind": "fuel",
        "config": {"chart": False},
        "open": ["trips", "refuels"],
    },
    {"file": "popup", "theme": "light", "kind": "fuel", "config": {}, "popup": {"amount": "41.2", "cost": "74.98"}},
]

# One GIF per animation, on a compact card. `names`: the animations stepped; the others are shown finished.
COMPACT = {"trips": False, "refuels": False}
GIFS = [
    {
        "file": "gauge",
        "kind": "plugin_hybrid",
        "config": {**COMPACT, "chart": False},
        "names": ["vc-fill"],
        "seconds": 2.0,
    },
    {
        "file": "chart",
        "kind": "fuel",
        "config": {**COMPACT, "months": 12},
        "names": ["vc-grow", "vc-fade"],
        "seconds": 2.6,
    },
    {
        "file": "driving",
        "kind": "fuel",
        "config": {**COMPACT, "chart": False},
        "extra": {"driving": True},
        "names": ["vc-pulse"],
        "seconds": 1.6,
    },
]


def page_html(theme):
    variables = "".join(f"{k}:{v};" for k, v in {**THEMES[theme], **COMMON}.items())
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
:root {{ {variables} }}
body {{ margin: 0; padding: 16px; background: var(--primary-background-color);
       font-family: Roboto, "Segoe UI", Helvetica, Arial, sans-serif; width: {WIDTH}px; }}
</style></head><body><div id="root"></div></body></html>"""


# Mounts the card on a new page; `open` unfolds sections, `popup` opens the add popup and types in its fields.
MOUNT = """([hass, config, open, popup]) => {
    const el = document.createElement("vehicle-consumption-card");
    el.setConfig({ type: "custom:vehicle-consumption-card", ...config });
    el.hass = { ...hass, callService: async () => {} };
    document.getElementById("root").appendChild(el);
    // Several sections at once (a click on one folds the others back, like on a dashboard).
    if (open) {
        el._open = new Set(open);
        el._render(true);
    }
    if (popup) {
        el.shadowRoot.querySelector(".add").click();
        for (const [name, value] of Object.entries(popup)) {
            const input = el.shadowRoot.querySelector(`input[name="${name}"]`);
            input.value = value;
            input.dispatchEvent(new Event("input"));
        }
        el.shadowRoot.activeElement?.blur();
    }
}"""


def open_card(browser, shot):
    page = browser.new_page(device_scale_factor=2, viewport={"width": 1000, "height": 1600})
    page.on("pageerror", lambda err, name=shot["file"]: print(f"{name}: page error: {err}"))
    page.clock.set_fixed_time(NOW)
    page.set_content(page_html(shot.get("theme", "light")))
    page.add_script_tag(content=HA_ELEMENTS)
    page.add_script_tag(content=CARD_JS)
    hass = mock_hass(shot["kind"], **shot.get("extra", {}))
    page.evaluate(MOUNT, [hass, shot["config"], shot.get("open"), shot.get("popup")])
    page.wait_for_timeout(400)
    box = page.locator("#root").bounding_box()
    clip = {"x": 0, "y": 0, "width": WIDTH + 32, "height": int(box["height"] + 0.999) + 32}
    return page, clip


def animate(browser, shot, *, fps=20):
    """Record one animation as a looping screenshots/<file>.gif (needs ffmpeg). Every animation is paused and stepped
    frame by frame, so the GIF is identical whatever the machine's speed; the other animations are shown finished."""
    page, clip = open_card(browser, shot)
    frames = round(fps * shot["seconds"])
    hold = fps if "vc-pulse" not in shot["names"] else 0
    with tempfile.TemporaryDirectory() as frame_dir:
        for i in range(frames + hold):
            page.evaluate(
                """([t, names]) => {
                    for (const a of document.getAnimations()) {
                        a.pause();
                        a.currentTime = names.includes(a.animationName) ? t : 100000;
                    }
                }""",
                [min(i, frames) * 1000 / fps, shot["names"]],
            )
            page.screenshot(path=f"{frame_dir}/f{i:03d}.png", clip=clip)
        page.close()
        out = str(ROOT / "screenshots" / f"{shot['file']}.gif")
        subprocess.run(
            [
                FFMPEG,
                "-y",
                "-loglevel",
                "error",
                "-framerate",
                str(fps),
                "-i",
                f"{frame_dir}/f%03d.png",
                "-vf",
                f"scale={clip['width']}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4",
                "-loop",
                "0",
                out,
            ],
            check=True,
        )
    print(f"screenshots/{shot['file']}.gif")


def main():
    (ROOT / "screenshots").mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH") or None)
        for shot in SHOTS:
            page, clip = open_card(browser, shot)
            path = ROOT / "screenshots" / f"{shot['file']}.png"
            page.screenshot(path=str(path), clip=clip, animations="disabled")
            print(path.relative_to(ROOT))
            page.close()
        for shot in GIFS:
            animate(browser, shot)
        browser.close()


if __name__ == "__main__":
    main()

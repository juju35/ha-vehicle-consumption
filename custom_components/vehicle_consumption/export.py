"""CSV export of a vehicle's trips, refuels and charges (the `export` action)."""

from __future__ import annotations

import csv
from pathlib import Path
from typing import TYPE_CHECKING, Any

from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from homeassistant.util import slugify

from .const import DOMAIN

if TYPE_CHECKING:
    from .tracker import ConsumptionTracker

# Every column, in this order, whatever rows there are: trips, refuels and charges share one header.
COLUMNS = (
    "type",
    "start",
    "end",
    "time",
    "distance",
    "fuel",
    "energy",
    "liters",
    "cost",
    "price",
    "odometer",
    "fuel_consumption",
    "energy_consumption",
    "cost_per_km",
    "co2",
    "source",
    "estimated",
)


async def async_export(hass: HomeAssistant, tracker: ConsumptionTracker, path_value: str | None) -> dict[str, Any]:
    """Write the vehicle's history as a CSV file; returns its path and row count."""
    path = Path(path_value or f"vehicle_consumption_{slugify(tracker.name)}.csv")
    if not path.is_absolute():
        path = Path(hass.config.path(str(path)))
    if refused := await hass.async_add_executor_job(_refused, hass, path):
        raise ServiceValidationError(
            translation_domain=DOMAIN, translation_key=refused, translation_placeholders={"path": str(path)}
        )
    rows = tracker.export_rows()
    try:
        await hass.async_add_executor_job(_write_csv, path, rows)
    except OSError as err:
        raise HomeAssistantError(f"Could not write {path}: {err}") from err
    return {"path": str(path), "rows": len(rows)}


def _refused(hass: HomeAssistant, path: Path) -> str | None:
    """Why the export may not write `path` (a translation key), None when it may (blocking: resolves the path).

    Only a .csv file (never an existing file of another kind, symlinks followed), outside hidden folders
    such as .storage, inside the configuration folder or an allowlist_external_dirs folder.
    """
    try:
        target = path.resolve()
        config = Path(hass.config.config_dir).resolve()
        roots = [config, *(Path(d).resolve() for d in hass.config.allowlist_external_dirs)]
        exists = target.exists()
    except OSError:
        return "path_not_allowed"
    root = next((r for r in roots if target.is_relative_to(r)), None)
    if root is None:
        return "path_not_allowed"
    if any(part.startswith(".") for part in target.relative_to(root).parts):
        return "path_hidden"
    if target.suffix.lower() != ".csv" or (exists and not target.is_file()):
        return "path_not_csv"
    return None


def _write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    """Write the rows (UTF-8), the known columns first, then any other key a row has."""
    path.parent.mkdir(parents=True, exist_ok=True)
    columns = list(COLUMNS) + sorted({k for r in rows for k in r} - set(COLUMNS))
    with path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

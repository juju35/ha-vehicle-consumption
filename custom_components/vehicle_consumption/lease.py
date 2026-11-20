"""Lease mileage allowance: distance driven since the contract started against the allowance, pro rata, projection.

Options (all set or no lease): `lease_start` (date), `lease_months`, `lease_distance` (km for the whole contract);
`lease_start_odometer` (km at delivery, 0 by default) and `lease_extra_price` (per km over the allowance) are optional.
Everything is worked out at read time from the odometer and the months tracked: nothing is stored.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from homeassistant.util import dt as dt_util

from .const import (
    CONF_LEASE_DISTANCE,
    CONF_LEASE_EXTRA_PRICE,
    CONF_LEASE_MONTHS,
    CONF_LEASE_START,
    CONF_LEASE_START_ODOMETER,
    LEASE_PACE_MONTHS,
)

# Average days in a month: months elapsed and left as fractions.
_DAYS_PER_MONTH = 365.25 / 12


def _add_months(start: date, months: int) -> date:
    """`start` plus `months` calendar months (the 31st of a shorter month: its last day)."""
    month = start.month - 1 + months
    year, month = start.year + month // 12, month % 12 + 1
    for day in (start.day, 30, 29, 28):
        try:
            return date(year, month, day)
        except ValueError:
            continue
    return date(year, month, 28)


def _parse_date(value: Any) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str) and value:
        try:
            return date.fromisoformat(value[:10])
        except ValueError:
            return None
    return None


def _number(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number >= 0 else None


@dataclass(frozen=True)
class Lease:
    """The contract: start date, length (months), allowance and odometer at delivery (km), price of an extra km."""

    start: date
    months: int
    distance: float
    start_odometer: float = 0.0
    extra_price: float | None = None

    @property
    def end(self) -> date:
        return _add_months(self.start, self.months)

    @classmethod
    def from_options(cls, options: dict[str, Any]) -> Lease | None:
        """The lease of the options, None unless its start, length and allowance are all set."""
        start = _parse_date(options.get(CONF_LEASE_START))
        months = _number(options.get(CONF_LEASE_MONTHS))
        distance = _number(options.get(CONF_LEASE_DISTANCE))
        if start is None or not months or not distance:
            return None
        price = _number(options.get(CONF_LEASE_EXTRA_PRICE))
        return cls(
            start=start,
            months=int(months),
            distance=distance,
            start_odometer=_number(options.get(CONF_LEASE_START_ODOMETER)) or 0.0,
            extra_price=price or None,
        )

    def status(self, odometer: float | None, months: list[dict[str, Any]], today: date | None = None) -> dict[str, Any]:
        """Where the contract stands today (km, metric): driven, pro rata, balance (+ = over), left, projection.

        `months` is the tracker's months summary (oldest first, `month` YYYY-MM and `distance` in km): the pace is the
        average of the last `LEASE_PACE_MONTHS` complete months since the start, else the average since the start.
        """
        today = today or dt_util.as_local(dt_util.utcnow()).date()
        end = self.end
        span = max((end - self.start).days, 1)
        elapsed_days = min(max((today - self.start).days, 0), span)
        months_elapsed = elapsed_days / _DAYS_PER_MONTH
        months_left = max((end - today).days, 0) / _DAYS_PER_MONTH
        driven = max(odometer - self.start_odometer, 0.0) if odometer is not None else None
        prorata = self.distance * elapsed_days / span
        pace = self._pace(months, today, driven, months_elapsed)
        projected = driven + pace * months_left if driven is not None and pace is not None else driven
        overage = max(projected - self.distance, 0.0) if projected is not None else None
        remaining = self.distance - driven if driven is not None else None
        return {
            "start": self.start.isoformat(),
            "end": end.isoformat(),
            "months": self.months,
            "month": self._month_number(today),
            "ended": today >= end,
            "allowance": self.distance,
            "driven": _round(driven),
            "prorata": _round(prorata),
            "balance": _round(driven - prorata) if driven is not None else None,
            "remaining": _round(remaining),
            "per_month_left": _round(remaining / months_left) if remaining is not None and months_left >= 1 else None,
            "pace": _round(pace),
            "projected": _round(projected),
            "overage": _round(overage),
            "extra_price": self.extra_price,
            "overage_cost": round(overage * self.extra_price, 2)
            if overage is not None and self.extra_price is not None
            else None,
        }

    def _month_number(self, today: date) -> int:
        """The month of the contract `today` is in (1 the first), 0 before the start, the last one after the end."""
        if today < self.start:
            return 0
        months = (today.year - self.start.year) * 12 + today.month - self.start.month
        return min(months + (1 if today.day >= self.start.day else 0), self.months)

    def _pace(
        self, months: list[dict[str, Any]], today: date, driven: float | None, months_elapsed: float
    ) -> float | None:
        """Kilometres a month: the last complete months tracked since the start, else the average since the start."""
        current = today.strftime("%Y-%m")
        first_full = _add_months(self.start.replace(day=1), 1 if self.start.day > 1 else 0).strftime("%Y-%m")
        full = [
            float(m["distance"])
            for m in months
            if first_full <= str(m.get("month", "")) < current and isinstance(m.get("distance"), int | float)
        ][-LEASE_PACE_MONTHS:]
        if len(full) >= LEASE_PACE_MONTHS:
            return sum(full) / len(full)
        if driven is not None and months_elapsed >= 1:
            return driven / months_elapsed
        return None


def _round(value: float | None) -> float | None:
    return None if value is None else round(value)


def to_miles(status: dict[str, Any], km_per_mile: float) -> dict[str, Any]:
    """The distances of `status` in miles (imperial units), the price per mile; the rest as is."""
    out = dict(status)
    for key in (
        "allowance",
        "driven",
        "prorata",
        "balance",
        "remaining",
        "per_month_left",
        "pace",
        "projected",
        "overage",
    ):
        if out.get(key) is not None:
            out[key] = round(out[key] / km_per_mile)
    if out.get("extra_price") is not None:
        out["extra_price"] = round(out["extra_price"] * km_per_mile, 4)
    return out

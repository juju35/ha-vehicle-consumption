"""Every translation file has exactly the keys and placeholders of the English one."""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

TRANSLATIONS = Path(__file__).parent.parent / "custom_components" / "vehicle_consumption" / "translations"
PLACEHOLDER = re.compile(r"\{(\w+)\}")


def _flatten(data: dict, prefix: str = "") -> dict[str, str]:
    out: dict[str, str] = {}
    for key, value in data.items():
        path = f"{prefix}{key}"
        if isinstance(value, dict):
            out.update(_flatten(value, f"{path}."))
        else:
            out[path] = value
    return out


def _load(lang: str) -> dict[str, str]:
    return _flatten(json.loads((TRANSLATIONS / f"{lang}.json").read_text(encoding="utf-8")))


def test_languages() -> None:
    """English, French, German and Spanish are shipped."""
    assert {p.stem for p in TRANSLATIONS.glob("*.json")} >= {"en", "fr", "de", "es"}


@pytest.mark.parametrize("lang", sorted(p.stem for p in TRANSLATIONS.glob("*.json") if p.stem != "en"))
def test_parity(lang: str) -> None:
    """Same keys as English, same placeholders in every string."""
    en, other = _load("en"), _load(lang)
    assert sorted(other) == sorted(en)
    for key, text in en.items():
        assert sorted(PLACEHOLDER.findall(other[key])) == sorted(PLACEHOLDER.findall(text)), f"{lang}: {key}"


def test_exact_languages() -> None:
    """No other language is shipped (the card has the same four)."""
    assert {p.stem for p in TRANSLATIONS.glob("*.json")} == {"en", "fr", "de", "es"}


def test_every_entity_and_service_translated() -> None:
    """Every sensor key of the integration and every action has its English name."""
    import yaml

    from custom_components.vehicle_consumption.sensor import SENSORS

    en = _load("en")
    for key in [d.key for d in SENSORS] + ["consumption", "last_refuel", "last_charge"]:
        assert f"entity.sensor.{key}.name" in en, key
    services = yaml.safe_load((TRANSLATIONS.parent / "services.yaml").read_text(encoding="utf-8"))
    for service, spec in services.items():
        assert f"services.{service}.name" in en, service
        for field in spec["fields"]:
            assert f"services.{service}.fields.{field}.name" in en, f"{service}.{field}"

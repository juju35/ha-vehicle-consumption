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


LANGUAGES = {"en", "fr", "de", "es", "it", "nl", "pt", "pl", "sr", "sr-Latn"}


def test_languages() -> None:
    """English, French, German, Spanish, Italian, Dutch, Portuguese, Polish and Serbian (both scripts) are shipped."""
    assert {p.stem for p in TRANSLATIONS.glob("*.json")} >= LANGUAGES


@pytest.mark.parametrize("lang", sorted(LANGUAGES - {"en"}))
def test_parity(lang: str) -> None:
    """Same keys as English, same placeholders in every string, no empty string."""
    en, other = _load("en"), _load(lang)
    assert sorted(other) == sorted(en)
    for key, text in en.items():
        assert isinstance(other[key], str), f"{lang}: {key}"
        assert other[key].strip(), f"{lang}: {key} is empty"
        assert sorted(PLACEHOLDER.findall(other[key])) == sorted(PLACEHOLDER.findall(text)), f"{lang}: {key}"


def test_exact_languages() -> None:
    """No other language is shipped (the card has the same ten)."""
    assert {p.stem for p in TRANSLATIONS.glob("*.json")} == LANGUAGES


# Serbian Cyrillic letter by letter, then its Latin spelling (љ, њ and џ take two letters).
_SERBIAN = "аaбbвvгgдdђđеeжžзzиiјjкkлlљljмmнnњnjоoпpрrсsтtћćуuфfхhцcчčџdžшš"
_TO_LATIN = dict(re.findall(r"([а-џ])([^а-џ]+)", _SERBIAN))
_TO_LATIN |= {c.upper(): lat.capitalize() for c, lat in _TO_LATIN.items()}
# Latin words allowed in the Cyrillic file: names, brands, acronyms and units.
_LATIN_NAMES = re.compile(
    r"Vehicle Consumption|Home Assistant|Renault|Tesla|Kia|Volkswagen|OBD|evcc|Wallbox|Easee|Zaptec|Ohme"
    r"|\b(?:km|mi|L|gal|kWh|Wh)\b|\{\w+\}"
)


def test_serbian_scripts_match() -> None:
    """The Cyrillic and Latin Serbian files say the same thing, letter for letter, each in its own script."""
    cyrillic, latin = _load("sr"), _load("sr-Latn")
    assert sorted(cyrillic) == sorted(latin)
    for key, text in cyrillic.items():
        assert "".join(_TO_LATIN.get(ch, ch) for ch in text) == latin[key], key
        assert not re.search(r"[A-Za-z]", _LATIN_NAMES.sub("", text)), f"sr: {key}"
        assert not re.search(r"[\u0400-\u04ff]", latin[key]), f"sr-Latn: {key}"


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

/**
 * vehicle-consumption-card — the fuel and energy consumption tracked by the Vehicle Consumption integration:
 * tank and battery gauges, last trip, this month, average, cost per km, a monthly chart, the recent trips and the
 * refuels / charges, with a popup to log a refuel or a charge by hand. vehicle-consumption-mini-card: the compact view
 * (gauges, last trip, average), whose detail button opens the full card.
 * Served and added to the dashboard resources by the integration.
 * https://github.com/juju35/ha-vehicle-consumption
 */
import { VC_I18N } from "./i18n/strings.js";

export var VEHICLE_CONSUMPTION_CARD_VERSION = '1.10.5';


export const vcLang = (hass, config) => {
  const raw = String(config?.language || hass?.locale?.language || hass?.language || 'en');
  // Exact code first (sr-Latn, Serbian in Latin script), then its base language (fr-FR → fr), then English.
  if (VC_I18N[raw]) return raw;
  const l = raw.split('-')[0];
  return VC_I18N[l] ? l : 'en';
};

export const vcT = (lang, key, vars = {}) =>
  (VC_I18N[lang]?.[key] ?? VC_I18N.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

export const vcEsc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const VC_DEFAULTS = {
  show_title: true,
  // The illustrated header (fuel pump or charging station on a road), its picture following the sun.
  illustration: true,
  illustration_theme: 'auto',
  chart: true,
  chart_metric: 'consumption',
  months: 6,
  trips: true,
  refuels: true,
  // The lease allowance section, shown when the vehicle has a lease (integration options).
  lease: true,
  add_button: true,
  // Mini card: the detail button (top right) that opens the full view.
  zoom: true,
};
export const VC_METRICS = ['consumption', 'distance', 'cost', 'co2'];
// Rows listed in a folded section, newest first.
export const VC_ROWS = 5;
// A gauge under this level turns to the warning colour.
export const VC_LOW = 15;
// First-render animations (gauge fill, chart bars) last this long: a re-render inside that window resumes them.
export const VC_ANIM_MS = 1600;
export const VC_DASH = '—';

export const vcFinite = (v) => v != null && v !== '' && Number.isFinite(Number(v));

// The units of the figures the integration gives (its `units` option): metric, or imperial (miles, US gallons, mpg,
// mi/kWh, cost and CO₂ per mile). The source odometer's unit (`odometer_unit`): what an odometer entered by hand is in.
export const VC_KM = { km: 1, mi: 1.609344, m: 0.001 };
export const VC_GALLON = 3.785411784;
export function vcUnits(a) {
  const imperial = a?.units === 'imperial';
  const dist = imperial ? 'mi' : 'km';
  const source = a?.odometer_unit in VC_KM ? a.odometer_unit : dist;
  return {
    imperial,
    dist,
    vol: imperial ? 'gal' : 'L',
    fuel: imperial ? 'mpg' : 'L/100 km',
    energy: imperial ? 'mi/kWh' : 'kWh/100 km',
    odometer: source,
    // An odometer shown (in `dist`) to the odometer sensor's unit, and litres from what is typed (gal or L).
    toSource: (v) => (v * VC_KM[dist]) / VC_KM[source],
    toLiters: (v) => (imperial ? v * VC_GALLON : v),
  };
}

// Home Assistant's `pt` is European Portuguese, while Intl reads a bare `pt` as Brazilian (« € 1.234 », « 30 de out. »).
export const vcIntlLocale = (l) => (String(l || '').toLowerCase() === 'pt' ? 'pt-PT' : l);

// Number, money and date formatting: numbers follow Home Assistant's number format (its locale by default),
// month and day names follow the card language.
export function vcFormat(hass, lang, currency) {
  const loc = hass?.locale || {};
  const byFormat = { comma_decimal: 'en-US', decimal_comma: 'de-DE', space_comma: 'fr-FR', system: undefined };
  const locale = vcIntlLocale(loc.number_format in byFormat ? byFormat[loc.number_format] : loc.language || hass?.language || lang);
  const grouping = loc.number_format !== 'none';
  const cache = new Map();
  const nf = (opts) => {
    const key = JSON.stringify(opts);
    if (!cache.has(key)) {
      let f;
      try {
        f = new Intl.NumberFormat(locale, { useGrouping: grouping, ...opts });
      } catch {
        f = new Intl.NumberFormat('en', { useGrouping: grouping, ...opts });
      }
      cache.set(key, f);
    }
    return cache.get(key);
  };
  const cur = /^[A-Z]{3}$/.test(String(currency || '')) ? currency : null;
  const num = (v, digits = 1) =>
    vcFinite(v) ? nf({ minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(v)) : VC_DASH;
  // narrowSymbol: Romanian, Hungarian and Ukrainian would otherwise print "0,107 EUR", too wide for the cost tile.
  const money = (v, digits = 2) => {
    if (!vcFinite(v)) return VC_DASH;
    if (!cur) return num(v, digits);
    return nf({ style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(v));
  };
  const symbol = () => (cur ? nf({ style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find((p) => p.type === 'currency')?.value || cur : '');
  // Home Assistant's full locale (pt-BR, de-CH) when it resolves to the card language, the card language otherwise
  // (a card set to sr keeps Cyrillic month names under a Home Assistant in sr-Latn).
  const haLang = String(loc.language || hass?.language || '');
  let dateLocale = vcIntlLocale(haLang && vcLang({ language: haLang }, {}) === lang ? haLang : lang);
  try {
    Intl.DateTimeFormat.supportedLocalesOf(dateLocale);
  } catch {
    dateLocale = vcIntlLocale(lang);
  }
  const dateFmt = new Intl.DateTimeFormat(dateLocale, { day: 'numeric', month: 'short' });
  // Home Assistant's 12 / 24 h setting ('language' and 'system' leave it to the locale).
  const hour12 = loc.time_format === '12' ? true : loc.time_format === '24' ? false : undefined;
  const timeFmt = new Intl.DateTimeFormat(dateLocale, {
    hour: '2-digit',
    minute: '2-digit',
    ...(hour12 === undefined ? {} : { hourCycle: hour12 ? 'h12' : 'h23' }),
  });
  const monthFmt = new Intl.DateTimeFormat(dateLocale, { month: 'short', timeZone: 'UTC' });
  const date = (iso, withTime = true) => {
    const d = iso ? new Date(iso) : null;
    if (!d || Number.isNaN(d.getTime())) return VC_DASH;
    return withTime ? `${dateFmt.format(d)}, ${timeFmt.format(d)}` : dateFmt.format(d);
  };
  // "2026-10" → "Oct" (short month name, without the trailing dot some languages add).
  const month = (key) => {
    const [y, m] = String(key).split('-').map(Number);
    return y && m ? monthFmt.format(new Date(Date.UTC(y, m - 1, 15))).replace(/\.$/, '') : '';
  };
  return { num, money, symbol, date, month };
}

// The `n` month keys ending with `last` ("YYYY-MM"), oldest first.
export function vcMonthKeys(last, n) {
  let [y, m] = String(last).split('-').map(Number);
  if (!y || !m) {
    const now = new Date();
    y = now.getFullYear();
    m = now.getMonth() + 1;
  }
  const keys = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = y * 12 + (m - 1) - i;
    keys.push(`${Math.floor(d / 12)}-${String((d % 12) + 1).padStart(2, '0')}`);
  }
  return keys;
}

// The integration's sensors, from the entity registry, scanned once per registry object (an empty scan is not kept:
// the registry may not be loaded yet).
export const vcScans = new WeakMap();
export const vcCandidates = (registry) => {
  if (!registry) return [];
  const kept = vcScans.get(registry);
  if (kept) return kept;
  const found = Object.keys(registry).filter((id) => id.startsWith('sensor.') && registry[id]?.platform === 'vehicle_consumption');
  if (found.length) vcScans.set(registry, found);
  return found;
};

// The vehicle's display name: its `vehicle` attribute, else the sensor's friendly name, else the entity id.
export const vcVehicleName = (st, id) => String(st?.attributes?.vehicle || st?.attributes?.friendly_name || id);

// Every vehicle: the main "Consumption" sensor of each config entry, the one whose state carries the monthly history,
// as [{ entity, name }] sorted by name (stable whatever the registry order).
export const vcVehicles = (hass) =>
  vcCandidates(hass?.entities)
    .filter((id) => Array.isArray(hass?.states?.[id]?.attributes?.months))
    .map((id) => ({ entity: id, name: vcVehicleName(hass.states[id], id) }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.entity.localeCompare(b.entity));

// The first vehicle's sensor, or undefined.
export const vcPick = (hass) => vcVehicles(hass)[0]?.entity;

// No vehicle with its history (Home Assistant starting, the integration reloading): the main sensor that is down,
// by its translation key, else any sensor of the integration when they are all down; undefined when none is.
export const vcDown = (hass) => {
  const ids = vcCandidates(hass?.entities);
  const down = (id) => ['unavailable', 'unknown', undefined].includes(hass?.states?.[id]?.state);
  const main = ids.filter((id) => hass.entities[id]?.translation_key === 'consumption' && down(id)).sort()[0];
  return main || (ids.length && ids.every(down) ? [...ids].sort()[0] : undefined);
};

// Which energies the vehicle tracks.
export const vcTracks = (kind) => ({ fuel: kind !== 'electric', energy: kind === 'electric' || kind === 'plugin_hybrid' });

// A decimal typed with a comma or a dot, or null.
export const vcParse = (s) => {
  const v = Number(String(s ?? '').trim().replace(/\s/g, '').replace(',', '.'));
  return String(s ?? '').trim() !== '' && Number.isFinite(v) ? v : null;
};

// A click inside a dialog opened from the card (more-info, a picker) is not a click outside it.
// The sections (data-section) an event went through.
export const vcSections = (ev) => (ev?.composedPath?.() || []).map((n) => n?.dataset?.section).filter(Boolean);
export const vcInDialog = (ev) => ev.composedPath().some((n) => ['ha-more-info-dialog', 'ha-dialog', 'dialog'].includes(n?.localName));

// The badge: the gauge of the projects site, coloured by the card's level.
export const VC_ICON = 'mdi:gauge-low';
export const VC_KINDS = ['fuel', 'electric', 'plugin_hybrid'];

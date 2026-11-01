// Unit tests for the card: the card file is evaluated with stubs, no browser needed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(
  new URL('../custom_components/vehicle_consumption/frontend/vehicle-consumption-card.js', import.meta.url),
  'utf8',
);

// An ha-form stand-in for the editor: what the user changes.
const fakeNode = () => ({
  handlers: {},
  addEventListener(type, fn) {
    this.handlers[type] = fn;
  },
  dispatch(value) {
    this.handlers['value-changed']({ detail: { value } });
  },
});
const listeners = {};
const context = {
  HTMLElement: class {},
  customElements: { get: () => true, define() {} },
  window: {},
  document: {
    createElement: () => fakeNode(),
    addEventListener: (type, fn) => (listeners[type] = fn),
    removeEventListener: (type) => delete listeners[type],
  },
  CustomEvent: class {
    constructor(type, init) {
      this.type = type;
      this.detail = init?.detail;
    }
  },
  console,
  Date,
  Intl,
};
vm.createContext(context);
vm.runInContext(
  `${source}\nthis.vc = { VehicleConsumptionCard, VehicleConsumptionCardEditor, VC_I18N, VC_DEFAULTS, vcEsc, vcLang, vcT, vcFormat, vcMonthKeys, vcParse, vcVehicles };`,
  context,
);
const { VehicleConsumptionCard, VehicleConsumptionCardEditor, VC_I18N, vcEsc, vcLang, vcT, vcFormat, vcMonthKeys, vcParse, vcVehicles } =
  context.vc;

const SENSOR = 'sensor.family_car_consumption';
const months = (fn) =>
  ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'].map((month, i) => ({ month, ...fn(i) }));
const fuelAttrs = (extra = {}) => ({
  vehicle: 'Family car',
  entry_id: 'entry1',
  kind: 'fuel',
  currency: 'EUR',
  odometer: 48210.4,
  fuel_quantity: 31.5,
  fuel_level: 63,
  tank_capacity: 50,
  battery_energy: null,
  battery_level: null,
  driving: false,
  trip: { start: '2026-10-30T08:00:00+01:00', end: '2026-10-30T08:40:00+01:00', distance: 42.3, fuel: 2.4, fuel_consumption: 5.7, cost: 4.32, cost_per_km: 0.102 },
  month: { month: '2026-10', distance: 812, fuel: 48.1, fuel_consumption: 5.9, cost: 86.6, cost_per_km: 0.107 },
  total: { since: '2025-11-01T00:00:00+01:00', distance: 9800, fuel_consumption: 6.1, cost: 1050, cost_per_km: 0.107 },
  months: months((i) => ({ distance: 700 + i * 20, fuel_consumption: i === 1 ? null : 5.5 + i / 10, cost: 80 + i })),
  trips: [{ start: '2026-10-30T08:00:00+01:00', distance: 42.3, fuel_consumption: 5.7, cost: 4.32 }],
  refuels: [
    { time: '2026-10-28T18:00:00+01:00', odometer: 48100, liters: 41.2, cost: 74.1, source: 'auto' },
    { time: '2026-10-10T18:00:00+01:00', odometer: 47400, liters: 38, cost: null, source: 'manual' },
  ],
  charges: [],
  ...extra,
});
const evAttrs = () =>
  fuelAttrs({
    vehicle: 'City EV',
    kind: 'electric',
    fuel_quantity: null,
    fuel_level: null,
    battery_energy: 38.4,
    battery_level: 72,
    trip: { distance: 18, energy: 2.9, energy_consumption: 16.1, cost: 0.73 },
    month: { month: '2026-10', distance: 640, energy_consumption: 15.8, cost: 25.3, cost_per_km: 0.04 },
    total: { distance: 7000, energy_consumption: 16.2, cost_per_km: 0.041 },
    refuels: [],
    charges: [{ time: '2026-10-29T22:00:00+01:00', odometer: 21000, energy: 30.5, cost: 7.6, source: 'auto' }],
  });

const registry = () => ({
  'sensor.family_car_distance_trip': { platform: 'vehicle_consumption' },
  [SENSOR]: { platform: 'vehicle_consumption' },
  'sensor.other': { platform: 'renault' },
});
const hassWith = (attributes, extra = {}) => ({
  entities: registry(),
  states: {
    'sensor.family_car_distance_trip': { state: '42.3', attributes: { unit_of_measurement: 'km' } },
    ...(attributes ? { [SENSOR]: { state: '6.1', attributes: { unit_of_measurement: 'L/100 km', ...attributes } } } : {}),
  },
  language: 'en',
  locale: { language: 'en', number_format: 'language' },
  calls: [],
  callService(domain, service, data) {
    this.calls.push({ domain, service, data });
    return Promise.resolve();
  },
  ...extra,
});

function makeCard(config = {}) {
  const card = new VehicleConsumptionCard();
  card.attachShadow = () => {
    card.shadowRoot = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
    return card.shadowRoot;
  };
  card.setConfig(config);
  return card;
}
// The markup without the stylesheet (whose selectors name every class).
const html = (card) => card.shadowRoot.innerHTML.replace(/<style>[\s\S]*?<\/style>/, '');

test('vcEsc escapes HTML', () => {
  assert.equal(vcEsc('<b a="1">\'&'), '&lt;b a=&quot;1&quot;&gt;&#39;&amp;');
  assert.equal(vcEsc(undefined), '');
});

test('vcLang: card option, then Home Assistant, then English', () => {
  assert.equal(vcLang({ locale: { language: 'fr-FR' } }, {}), 'fr');
  assert.equal(vcLang({ locale: { language: 'fr' } }, { language: 'en' }), 'en');
  assert.equal(vcLang({ language: 'de' }, {}), 'de');
  assert.equal(vcLang({ locale: { language: 'es-ES' } }, {}), 'es');
  assert.equal(vcLang({ language: 'ja' }, {}), 'en');
  // Italian, Dutch, Portuguese and Polish: region dropped; Brazilian Portuguese falls back to European Portuguese.
  assert.equal(vcLang({ locale: { language: 'it-IT' } }, {}), 'it');
  assert.equal(vcLang({ locale: { language: 'nl-BE' } }, {}), 'nl');
  assert.equal(vcLang({ language: 'pt' }, {}), 'pt');
  assert.equal(vcLang({ language: 'pt-BR' }, {}), 'pt');
  assert.equal(vcLang({ locale: { language: 'pl-PL' } }, {}), 'pl');
  // Serbian: Cyrillic by default, Latin script when Home Assistant (or the card) asks for sr-Latn.
  assert.equal(vcLang({ language: 'sr' }, {}), 'sr');
  assert.equal(vcLang({ locale: { language: 'sr-Latn' } }, {}), 'sr-Latn');
  assert.equal(vcLang({ language: 'en' }, { language: 'sr-Latn' }), 'sr-Latn');
  assert.equal(vcLang({ language: 'sr-Cyrl' }, {}), 'sr');
});

test('i18n Serbian: the Cyrillic and Latin cards say the same thing, letter for letter, each in its own script', () => {
  const cyr = 'абвгдђежзијклљмнњопрстћуфхцчџш';
  const lat = ['a', 'b', 'v', 'g', 'd', 'đ', 'e', 'ž', 'z', 'i', 'j', 'k', 'l', 'lj', 'm', 'n', 'nj', 'o', 'p', 'r', 's', 't', 'ć', 'u', 'f', 'h', 'c', 'č', 'dž', 'š'];
  const map = new Map();
  [...cyr].forEach((c, i) => {
    map.set(c, lat[i]);
    map.set(c.toUpperCase(), lat[i][0].toUpperCase() + lat[i].slice(1));
  });
  // Latin letters allowed in Cyrillic: names (Vehicle Consumption, Home Assistant), units (km) and placeholders.
  const names = /Vehicle Consumption|Home Assistant|\bkm\b|\{\w+\}/g;
  for (const [key, text] of Object.entries(VC_I18N.sr)) {
    assert.equal([...text].map((c) => map.get(c) ?? c).join(''), VC_I18N['sr-Latn'][key], key);
    assert.doesNotMatch(text.replace(names, ''), /[A-Za-z]/, `sr.${key}`);
    assert.doesNotMatch(VC_I18N['sr-Latn'][key], /[\u0400-\u04FF]/, `sr-Latn.${key}`);
  }
});

test('Serbian dates: month names in Cyrillic for sr, in Latin script for sr-Latn', () => {
  const hass = { locale: { language: 'en', number_format: 'language' } };
  assert.match(vcFormat(hass, 'sr', 'EUR').month('2026-10'), /^[\u0400-\u04FF]+$/);
  assert.equal(vcFormat(hass, 'sr-Latn', 'EUR').month('2026-10'), 'okt');
  assert.doesNotMatch(vcFormat(hass, 'sr-Latn', 'EUR').date('2026-10-30T08:00:00Z'), /[\u0400-\u04FF]/);
});

test('i18n: a key missing in a language falls back to English, then to the key', () => {
  VC_I18N.de._probe = undefined;
  VC_I18N.en._probe = 'probe {n}';
  assert.equal(vcT('de', '_probe', { n: 2 }), 'probe 2');
  assert.equal(vcT('xx', 'save'), 'Save');
  assert.equal(vcT('fr', 'nope'), 'nope');
  delete VC_I18N.de._probe;
  delete VC_I18N.en._probe;
});

const VC_LANGS = ['de', 'en', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'sr', 'sr-Latn'];

test('i18n parity: every language has exactly the English keys and placeholders, and no empty text', () => {
  const ph = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
  const keys = Object.keys(VC_I18N.en).sort();
  assert.deepEqual(Object.keys(VC_I18N).sort(), VC_LANGS);
  for (const lang of Object.keys(VC_I18N)) {
    assert.deepEqual(Object.keys(VC_I18N[lang]).sort(), keys, lang);
    for (const k of keys) {
      assert.equal(typeof VC_I18N[lang][k], 'string', `${lang}.${k}`);
      assert.ok(VC_I18N[lang][k].trim(), `${lang}.${k} is empty`);
      assert.equal(ph(VC_I18N[lang][k]), ph(VC_I18N.en[k]), `${lang}.${k}`);
    }
  }
});

test('formatting follows the locale; currency through Intl; missing values are a dash', () => {
  const fr = vcFormat({ locale: { language: 'fr', number_format: 'language' } }, 'fr', 'EUR');
  assert.equal(fr.num(5.85, 1).replace(/\s/g, ' '), '5,9');
  assert.match(fr.money(86.6), /86,60\s€/);
  assert.equal(fr.num(null), '—');
  assert.equal(fr.money(undefined), '—');
  assert.equal(fr.month('2026-10'), 'oct');
  const en = vcFormat({ locale: { language: 'en', number_format: 'language' } }, 'en', 'EUR');
  assert.equal(en.money(0.107, 3), '€0.107');
  assert.equal(en.num(48210.4, 0), '48,210');
  assert.equal(en.month('2026-01'), 'Jan');
  assert.equal(vcFormat({ locale: { language: 'en' } }, 'de', 'EUR').month('2026-03'), 'Mär');
  // Dates take Home Assistant's full locale when it resolves to the card language, the card language otherwise.
  const d = '2026-10-30T08:00:00Z';
  const dt = (loc, opts) => new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', ...opts }).format(new Date(d));
  assert.equal(vcFormat({ locale: { language: 'pt-BR' } }, 'pt', 'EUR').date(d, false), dt('pt-BR'));
  assert.equal(vcFormat({ locale: { language: 'en-GB' } }, 'pt', 'EUR').date(d, false), dt('pt-PT'));
  assert.match(vcFormat({ locale: { language: 'sr-Latn' } }, 'sr', 'EUR').month('2026-10'), /^[\u0400-\u04FF]+$/);
});

test('Home Assistant pt formats as European Portuguese (pt-PT), pt-BR stays Brazilian, the language option wins', () => {
  const d = '2026-10-30T08:00:00Z';
  const dt = (loc) => new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short' }).format(new Date(d));
  const nf = (loc, opts) => new Intl.NumberFormat(loc, { useGrouping: true, ...opts }).format(1234.5);
  const eur = { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 };
  const pt = vcFormat({ locale: { language: 'pt', number_format: 'language' } }, 'pt', 'EUR');
  assert.equal(pt.date(d, false), dt('pt-PT'));
  assert.equal(pt.money(1234.5), nf('pt-PT', eur));
  assert.notEqual(pt.money(1234.5), nf('pt-BR', eur));
  assert.equal(pt.num(1234.5, 1), nf('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  const br = vcFormat({ locale: { language: 'pt-BR', number_format: 'language' } }, 'pt', 'EUR');
  assert.equal(br.date(d, false), dt('pt-BR'));
  assert.equal(br.money(1234.5), nf('pt-BR', eur));
  // A card forced to pt under an English Home Assistant: European Portuguese dates.
  const hass = { locale: { language: 'en' } };
  const forced = vcLang(hass, { language: 'pt' });
  assert.equal(forced, 'pt');
  assert.equal(vcFormat(hass, forced, 'EUR').date(d, false), dt('pt-PT'));
  // A card forced to en under a Portuguese Home Assistant keeps English dates.
  const ptHass = { locale: { language: 'pt' } };
  assert.equal(vcFormat(ptHass, vcLang(ptHass, { language: 'en' }), 'EUR').date(d, false), dt('en'));
});

test('vcMonthKeys spans the year boundary; vcParse reads a comma or a dot', () => {
  assert.deepEqual([...vcMonthKeys('2026-02', 4)], ['2025-11', '2025-12', '2026-01', '2026-02']);
  assert.equal(vcParse('41,5'), 41.5);
  assert.equal(vcParse(' 12.25 '), 12.25);
  assert.equal(vcParse(''), null);
  assert.equal(vcParse('abc'), null);
});

test('lookup: the vehicle sensor carrying the monthly history is found among the integration sensors', () => {
  const card = makeCard();
  card.hass = hassWith(fuelAttrs());
  assert.equal(card._entity, SENSOR);
  assert.match(html(card), /Family car/);
});

test('lookup: the sensor appearing after the first render is found; the empty registry is not kept', () => {
  const card = makeCard();
  card.hass = { ...hassWith(null), entities: {} };
  assert.match(html(card), new RegExp(VC_I18N.en.not_loaded));
  card.hass = hassWith(null);
  assert.match(html(card), /Not set up/);
  card.hass = hassWith(fuelAttrs());
  assert.equal(card._entity, SENSOR);
  assert.doesNotMatch(html(card), /Not set up/);
});

test('a configured entity is used as is', () => {
  const card = makeCard({ entity: 'sensor.city_ev_consumption' });
  const hass = hassWith(null);
  hass.states['sensor.city_ev_consumption'] = { state: '16.2', attributes: { unit_of_measurement: 'kWh/100 km', ...evAttrs() } };
  card.hass = hass;
  assert.match(html(card), /City EV/);
});

test('not set up: the badge, the pill and a hint, no data', () => {
  const card = makeCard({ title: 'My car' });
  card.hass = hassWith(null);
  assert.match(html(card), /lvl-na/);
  assert.match(html(card), /My car/);
  assert.match(html(card), /Settings → Devices/);
  assert.doesNotMatch(html(card), /class="kpis"/);
});

test('fuel: one fuel gauge, L/100 km tiles, refuels section but no charges, average in the pill', () => {
  const card = makeCard();
  card.hass = hassWith(fuelAttrs());
  const out = html(card);
  assert.match(out, /mdi:gauge-low"/);
  assert.match(out, /g-fuel/);
  assert.doesNotMatch(out, /g-battery/);
  assert.match(out, /63 % · 31.5 L/);
  assert.match(out, /class="pill">6.1 L\/100 km</);
  assert.match(out, /5.7<small>L\/100 km/);
  assert.match(out, /€0.107<small>\/km/);
  assert.match(out, /data-section="refuels"/);
  assert.doesNotMatch(out, /data-section="charges"/);
  assert.match(out, /Logged by hand/);
});

test('electric: one battery gauge, kWh/100 km, charges section only', () => {
  const card = makeCard();
  const hass = hassWith(evAttrs());
  hass.states[SENSOR].state = '16.2';
  hass.states[SENSOR].attributes.unit_of_measurement = 'kWh/100 km';
  card.hass = hass;
  const out = html(card);
  assert.match(out, /mdi:gauge-low"/);
  assert.match(out, /g-battery/);
  assert.doesNotMatch(out, /g-fuel/);
  assert.match(out, /16.1<small>kWh\/100 km/);
  assert.match(out, /data-section="charges"/);
  assert.doesNotMatch(out, /data-section="refuels"/);
});

test('charges: home charger sessions are labelled, auto ones are not', () => {
  const card = makeCard();
  const charges = [
    { time: '2026-10-30T07:00:00+01:00', odometer: 21050, energy: 32.4, cost: 8.1, source: 'charger' },
    { time: '2026-10-29T22:00:00+01:00', odometer: 21000, energy: 30.5, cost: 7.6, source: 'auto' },
  ];
  card.hass = hassWith({ ...evAttrs(), charges });
  card._toggle('charges');
  card._render();
  const out = html(card);
  assert.match(out, /21,050 km · Home charger/);
  assert.equal(out.match(/Home charger/g).length, 1);
  assert.match(out, /32.4 kWh/);
});

test('plugin hybrid: two gauges, both consumptions in the tiles, refuels and charges', () => {
  const card = makeCard();
  card.hass = hassWith(
    fuelAttrs({
      kind: 'plugin_hybrid',
      battery_level: 40,
      battery_energy: 4.1,
      trip: { distance: 30, fuel_consumption: 2.1, energy_consumption: 12.4 },
    }),
  );
  const out = html(card);
  assert.match(out, /mdi:gauge-low"/);
  assert.match(out, /g-fuel/);
  assert.match(out, /g-battery/);
  assert.match(out, /2.1<small>L\/100 km.*12.4<small>kWh\/100 km/s);
  assert.match(out, /data-section="refuels"/);
  assert.match(out, /data-section="charges"/);
});

test('missing values show a dash; a low tank turns the card to warning', () => {
  const card = makeCard();
  card.hass = hassWith(fuelAttrs({ fuel_level: 9, fuel_quantity: null, trip: null, total: {}, month: {} }));
  const out = html(card);
  assert.match(out, /lvl-warn/);
  assert.match(out, /gauge g-fuel low/);
  assert.match(out, /class="kv">—</);
});

test('driving: pulsing dot in the header and the current trip', () => {
  const card = makeCard();
  card.hass = hassWith(fuelAttrs({ driving: true }));
  assert.match(html(card), /class="drive"/);
  assert.match(html(card), /lvl-drive/);
  assert.match(html(card), /Current trip/);
});

test('chart: the last N months, current month in accent, empty months as stubs, short month names', () => {
  const card = makeCard({ months: 4, language: 'fr' });
  card.hass = hassWith(fuelAttrs());
  const out = html(card);
  assert.equal((out.match(/class="col"/g) || []).length, 4);
  // July..October: August has values; June (null consumption) is out of the window; none is a stub here.
  assert.match(out, /class="bar now"/);
  assert.match(out, />oct</);
  assert.match(out, /4 derniers mois/);
  const card2 = makeCard({ months: 6 });
  card2.hass = hassWith(fuelAttrs());
  assert.equal((html(card2).match(/bar stub/g) || []).length, 1);
  const card3 = makeCard({ months: 12, chart_metric: 'cost' });
  card3.hass = hassWith(fuelAttrs());
  assert.equal((html(card3).match(/bar stub/g) || []).length, 6);
  assert.match(html(card3), /Cost<small>EUR/);
  const off = makeCard({ chart: false });
  off.hass = hassWith(fuelAttrs());
  assert.doesNotMatch(html(off), /class="chart"/);
});

test('an update that changes nothing the card reads does not re-render', () => {
  const card = makeCard();
  const hass = hassWith(fuelAttrs());
  card.hass = hass;
  card.shadowRoot.innerHTML = 'kept';
  card.hass = { ...hass, states: { ...hass.states, 'sensor.unrelated': { state: '1' } } };
  assert.equal(html(card), 'kept');
});

test('sections: folded by default, toggled open, folded back by a click elsewhere', () => {
  const card = makeCard();
  card.connectedCallback();
  card.hass = hassWith(fuelAttrs());
  assert.doesNotMatch(html(card), /section open/);
  card._toggle('trips');
  card._render();
  assert.match(html(card), /class="section open" data-section="trips"/);
  assert.match(html(card), /aria-expanded="true"/);
  // A click inside the open section keeps it open.
  listeners.click({ composedPath: () => [{ dataset: { section: 'trips' } }] });
  assert.ok(card._open.has('trips'));
  card._toggle('refuels');
  // A click anywhere else folds every open section.
  listeners.click({ composedPath: () => [{ dataset: {} }] });
  assert.equal(card._open.size, 0);
  card._render();
  assert.doesNotMatch(html(card), /section open/);
  card._toggle('trips');
  card._toggle('trips');
  assert.equal(card._open.size, 0);
  card.disconnectedCallback();
  assert.equal(listeners.click, undefined);
});

test('popup: opens at the top of the card, refuel payload, closes after the service call', async () => {
  const card = makeCard();
  const hass = hassWith(fuelAttrs());
  card.hass = hass;
  assert.match(html(card), /class="icon-btn add"/);
  card._openPopup();
  assert.match(html(card), /class="sheet"/);
  assert.match(html(card), /Log a refuel/);
  assert.doesNotMatch(html(card), /class="tabs"/);
  assert.match(html(card), /data-act="save" disabled/);
  card._input('amount', '41,5');
  card._input('cost', '72.3');
  card._input('odometer', '');
  await card._save();
  assert.deepEqual(JSON.parse(JSON.stringify(hass.calls)), [
    { domain: 'vehicle_consumption', service: 'add_refuel', data: { config_entry_id: 'entry1', liters: 41.5, cost: 72.3 } },
  ]);
  assert.equal(card._popup, null);
  assert.doesNotMatch(html(card), /class="sheet"/);
});

test('popup: an invalid amount is not sent; cancel and Escape close it', async () => {
  const card = makeCard();
  const hass = hassWith(fuelAttrs());
  card.hass = hass;
  card._openPopup();
  card._input('amount', 'abc');
  await card._save();
  assert.equal(hass.calls.length, 0);
  card._closePopup();
  assert.equal(card._popup, null);
  card._openPopup();
  listeners.keydown({ key: 'Escape' });
  assert.equal(card._popup, null);
  assert.equal(listeners.keydown, undefined);
});

test('popup: electric logs a charge; plugin hybrid switches between fuel and charge', async () => {
  const ev = makeCard();
  const hassEv = hassWith(evAttrs());
  ev.hass = hassEv;
  ev._openPopup();
  assert.match(html(ev), /Log a charge/);
  ev._input('amount', '30');
  ev._input('odometer', '21050');
  await ev._save();
  assert.deepEqual(JSON.parse(JSON.stringify(hassEv.calls[0])), {
    domain: 'vehicle_consumption',
    service: 'add_charge',
    data: { config_entry_id: 'entry1', energy: 30, odometer: 21050 },
  });

  const phev = makeCard();
  const hass = hassWith(fuelAttrs({ kind: 'plugin_hybrid', battery_level: 40 }));
  phev.hass = hass;
  phev._openPopup();
  assert.match(html(phev), /class="tabs"/);
  phev._setMode('charge');
  assert.match(html(phev), /Energy added/);
  phev._input('amount', '8.2');
  await phev._save();
  assert.equal(hass.calls[0].service, 'add_charge');
  assert.equal(hass.calls[0].data.energy, 8.2);
});

test('popup: a state update while typing waits until the popup closes', () => {
  const card = makeCard();
  const hass = hassWith(fuelAttrs());
  card.hass = hass;
  card._openPopup();
  const before = html(card);
  const next = hassWith(fuelAttrs({ odometer: 48300 }));
  card.hass = next;
  assert.equal(html(card), before);
  card._closePopup();
  assert.match(html(card), /Family car/);
});

test('popup: a failed service call keeps it open with the error', async () => {
  const card = makeCard();
  const hass = hassWith(fuelAttrs());
  hass.callService = () => Promise.reject(new Error('boom'));
  card.hass = hass;
  card._openPopup();
  card._input('amount', '10');
  await card._save();
  assert.ok(card._popup);
  assert.match(html(card), /Could not save: boom/);
});

test('the add button can be turned off', () => {
  const card = makeCard({ add_button: false });
  card.hass = hassWith(fuelAttrs());
  assert.doesNotMatch(html(card), /icon-btn add/);
});

test('editor: options left at their default are not written to the YAML', () => {
  const editor = new VehicleConsumptionCardEditor();
  editor.appendChild = () => {};
  const events = [];
  editor.dispatchEvent = (ev) => events.push(ev);
  editor.setConfig({ type: 'custom:vehicle-consumption-card' });
  editor.hass = hassWith(fuelAttrs());
  const form = editor._form;
  assert.deepEqual(JSON.parse(JSON.stringify(form.schema[0].selector.select.options)), [{ value: SENSOR, label: 'Family car' }]);
  assert.equal(form.data.months, 6);
  form.dispatch({
    type: 'custom:vehicle-consumption-card',
    entity: '',
    title: '',
    chart: true,
    chart_metric: 'consumption',
    months: 6,
    trips: false,
    refuels: true,
    add_button: true,
    language: 'fr',
  });
  assert.deepEqual(JSON.parse(JSON.stringify(events.at(-1).detail.config)), {
    type: 'custom:vehicle-consumption-card',
    trips: false,
    language: 'fr',
  });
  assert.equal(form.computeLabel({ name: 'months' }), 'Months in the chart');
  editor.setConfig({ language: 'de' });
  assert.equal(form.computeLabel({ name: 'months' }), 'Monate im Diagramm');
});

test('editor: the language picker offers every language of the card', () => {
  const editor = new VehicleConsumptionCardEditor();
  editor.appendChild = () => {};
  editor.setConfig({ type: 'custom:vehicle-consumption-card' });
  editor.hass = hassWith(fuelAttrs());
  const options = editor._form.schema.find((s) => s.name === 'language').selector.select.options;
  assert.deepEqual([...options.map((o) => o.value)].sort(), VC_LANGS);
  const labels = Object.fromEntries(options.map((o) => [o.value, o.label]));
  assert.equal(labels.it, 'Italiano');
  assert.equal(labels.nl, 'Nederlands');
  assert.equal(labels.pt, 'Português (Portugal)');
  assert.equal(labels.pl, 'Polski');
});

// Two vehicles: "Family car" (fuel) and "City EV" (electric), the EV listed last in the registry.
const EV_SENSOR = 'sensor.city_ev_consumption';
const twoVehicles = () => {
  const hass = hassWith(fuelAttrs());
  hass.entities = { ...hass.entities, [EV_SENSOR]: { platform: 'vehicle_consumption' } };
  hass.states[EV_SENSOR] = { state: '16.2', attributes: { unit_of_measurement: 'kWh/100 km', ...evAttrs() } };
  return hass;
};

test('discovery: every vehicle main sensor, by name, the other integration sensors left out', () => {
  const found = JSON.parse(JSON.stringify(vcVehicles(twoVehicles())));
  assert.deepEqual(found, [
    { entity: EV_SENSOR, name: 'City EV' },
    { entity: SENSOR, name: 'Family car' },
  ]);
  // No `vehicle` attribute: the friendly name.
  const hass = twoVehicles();
  hass.states[EV_SENSOR].attributes = { ...hass.states[EV_SENSOR].attributes, vehicle: '', friendly_name: 'Small EV' };
  assert.equal(vcVehicles(hass)[1].name, 'Small EV');
  assert.deepEqual([...vcVehicles({ entities: {}, states: {} })], []);
});

test('discovery: an empty registry is not kept, a new registry object is scanned again', () => {
  const hass = twoVehicles();
  const entities = {};
  assert.equal(vcVehicles({ ...hass, entities }).length, 0);
  Object.assign(entities, hass.entities);
  assert.equal(vcVehicles({ ...hass, entities }).length, 2);
  const card = makeCard();
  card.hass = { ...hass, entities: { [SENSOR]: { platform: 'vehicle_consumption' } } };
  assert.equal(card._entity, SENSOR);
  card.hass = hass;
  assert.equal(card._entity, EV_SENSOR);
});

test('stub config: the first vehicle found, else empty', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(VehicleConsumptionCard.getStubConfig(twoVehicles()))), { entity: EV_SENSOR });
  assert.deepEqual(JSON.parse(JSON.stringify(VehicleConsumptionCard.getStubConfig(hassWith(null)))), {});
  assert.deepEqual(JSON.parse(JSON.stringify(VehicleConsumptionCard.getStubConfig(undefined))), {});
});

test('card without entity: the first vehicle by name; with entity: that vehicle', () => {
  const card = makeCard();
  card.hass = twoVehicles();
  assert.equal(card._entity, EV_SENSOR);
  assert.match(html(card), /City EV/);
  const chosen = makeCard({ entity: SENSOR });
  chosen.hass = twoVehicles();
  assert.match(html(chosen), /Family car/);
});

test('editor: a Vehicle list of the vehicles found, keeping a configured sensor that is not found', () => {
  const editor = new VehicleConsumptionCardEditor();
  editor.appendChild = () => {};
  editor.dispatchEvent = () => {};
  editor.setConfig({ entity: 'sensor.old_car_consumption' });
  editor.hass = twoVehicles();
  const field = editor._form.schema[0];
  assert.equal(field.name, 'entity');
  assert.equal(field.selector.select.mode, 'dropdown');
  assert.deepEqual(JSON.parse(JSON.stringify(field.selector.select.options)), [
    { value: EV_SENSOR, label: 'City EV' },
    { value: SENSOR, label: 'Family car' },
    { value: 'sensor.old_car_consumption', label: 'sensor.old_car_consumption' },
  ]);
  assert.equal(editor._form.computeLabel({ name: 'entity' }), 'Vehicle');
  assert.equal(editor._form.computeHelper({ name: 'entity' }), 'Found automatically; leave empty to use the first vehicle');
  // A vehicle added later shows up at the next update.
  const hass = twoVehicles();
  const more = 'sensor.van_consumption';
  hass.entities = { ...hass.entities, [more]: { platform: 'vehicle_consumption' } };
  hass.states[more] = { state: '7', attributes: { ...fuelAttrs(), vehicle: 'Van' } };
  editor.hass = hass;
  assert.ok(editor._form.schema[0].selector.select.options.some((o) => o.value === more));
});

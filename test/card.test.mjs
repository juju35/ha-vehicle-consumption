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
// A ResizeObserver stand-in: the test calls `observers[i].fire(width)`.
const observers = [];
class FakeResizeObserver {
  constructor(cb) {
    this.cb = cb;
    this.targets = [];
    observers.push(this);
  }
  observe(el) {
    this.targets.push(el);
  }
  disconnect() {
    this.targets = [];
  }
  fire(width) {
    for (const target of this.targets) this.cb([{ target, contentRect: { width } }]);
  }
}
// Animation frames: queued, run by `nextFrame()`.
let frames = new Map();
let frameId = 0;
const nextFrame = () => {
  const due = frames;
  frames = new Map();
  for (const fn of due.values()) fn();
};
const context = {
  ResizeObserver: FakeResizeObserver,
  requestAnimationFrame: (fn) => {
    frames.set(++frameId, fn);
    return frameId;
  },
  cancelAnimationFrame: (id) => frames.delete(id),
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
  assert.match(out, /class="ptxt">6.1 L\/100 km</);
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

test('popup: the amount gets the focus without scrolling the dashboard', () => {
  const card = makeCard();
  card.hass = hassWith(fuelAttrs());
  const calls = [];
  const amount = { name: 'amount', addEventListener() {}, focus: (...args) => calls.push(args) };
  card.shadowRoot.querySelector = (sel) => (sel === 'input[name="amount"]' ? amount : null);
  card.shadowRoot.querySelectorAll = (sel) => (sel === 'input' ? [amount] : []);
  card._openPopup();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0]?.preventScroll, true);
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

// ── Review pass 9 ──
const styles = () => VehicleConsumptionCard.styles.replace(/\s+/g, ' ');
const rule = (selector) => {
  const css = styles();
  const at = css.indexOf(`} ${selector} {`) + 2;
  assert.ok(at >= 2, `no rule for ${selector}`);
  return css.slice(at, css.indexOf('}', at));
};
// WCAG contrast of `fg` over `bg` (hex), as the card mixes the ink: `color-mix(in srgb, c p%, text)`.
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, p) => a.map((v, i) => v * p + b[i] * (1 - p));
const lum = (rgb) =>
  rgb
    .map((v) => v / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

test('header: the title keeps a few letters, the pill shrinks and turns into a dot on a narrow card', () => {
  // A zero basis: a long title no longer takes the pill's room (the pill keeps its whole label while it fits).
  assert.match(rule('.title'), /flex: 1 1 0;/);
  assert.match(rule('.title'), /min-width: 4ch/);
  assert.match(rule('.tname'), /text-overflow: ellipsis/);
  const pill = rule('.pill');
  for (const p of ['flex: 0 1 auto', 'min-width: 0', 'max-width: 50%', 'overflow: hidden', 'text-overflow: ellipsis']) {
    assert.ok(pill.includes(p), p);
  }
  assert.match(rule('.pill.dot .ptxt'), /display: none/);
  assert.match(rule('.pill.dot .pdot'), /display: block/);
  for (const sel of ['.icon-btn', '.badge']) assert.match(rule(sel), /flex: none/);
  const card = makeCard();
  card.hass = hassWith(fuelAttrs());
  // The value stays readable for assistive technology and in the tooltip once only the dot shows.
  assert.match(html(card), /class="pill" title="6.1 L\/100 km" aria-label="6.1 L\/100 km"><span class="pdot"><\/span><span class="ptxt">6.1 L\/100 km<\/span>/);
});

test('width: the card keeps a width in a parent sized by its content, and still shrinks in a 1fr column', () => {
  const css = styles();
  const host = css.slice(css.indexOf(':host {'), css.indexOf('}', css.indexOf(':host {')));
  // min-width: 0 (never a px minimum on the host): a `1fr 1fr` grid can shrink it, no overflow.
  assert.match(host, /min-width: 0;/);
  assert.doesNotMatch(host, /min-width: [1-9]/);
  // The inline-size container would fall to its padding in an inline-block or an "auto" grid column: an empty grid
  // row gives the card a max-content width (300px) with a 0 min-content one.
  assert.match(rule('ha-card'), /container-type: inline-size;/);
  const before = css.match(/:host::before \{([^}]*)\}/);
  assert.ok(before, 'no :host::before rule');
  for (const p of ['content: ""', 'display: grid', 'grid-template-columns: minmax(0, 300px)', 'height: 0']) {
    assert.ok(before[1].includes(p), p);
  }
  // contain-intrinsic-* is a min-content width: wrapped in a div (or hui-card) in a `1fr 1fr` grid, whose
  // min-width stays auto, the card refused to shrink and overflowed by 160-340 px.
  assert.doesNotMatch(css, /contain-intrinsic/);
});

test('narrow: 8 of 12 columns at least, tighter header gaps when the label needs them (measured, no width)', () => {
  assert.equal(makeCard().getGridOptions().min_columns, 8);
  assert.match(styles(), /\.head:has\(\.pill\.tight\), \.head:has\(\.pill\.tight\) \.title \{ gap: 6px; \}/);
  assert.match(styles(), /\.pill\.tight \{ padding: 1px 6px; \}/);
  // A container width for them let a label fitting tight just under it turn into a dot just over it (277-278 px).
  assert.doesNotMatch(styles(), /@container \(max-width: \d+px\) \{\s*\.head/);
});

// A pill stand-in: its label is `need` px wide in a box of `room` px (what the flex layout leaves it), `tight` px
// more with the tighter header gaps.
const fakePill = (need, room, tight = 0) => {
  const classes = new Set();
  return {
    classes,
    classList: {
      add: (...names) => {
        for (const name of names) classes.add(name);
      },
      remove: (...names) => {
        for (const name of names) classes.delete(name);
      },
    },
    get scrollWidth() {
      return classes.has('dot') ? 18 : need;
    },
    get clientWidth() {
      return this.room + (classes.has('tight') ? tight : 0);
    },
    room,
  };
};
const cardWithPill = (pill) => {
  const card = makeCard();
  card.hass = hassWith(fuelAttrs());
  card.shadowRoot.querySelector = (sel) => (sel === '.pill' ? pill : null);
  return card;
};

test('pill: the whole label while it fits, else only the dot (measured on the label, any length)', () => {
  // A long label (kWh/100 km) cut by 6 px: only the dot, not a label cut with an ellipsis.
  const cut = fakePill(101, 95);
  cardWithPill(cut)._fitPill();
  assert.ok(cut.classes.has('dot'));
  // The same room with a label that fits (L/100 km): the whole label.
  const fits = fakePill(90, 95);
  cardWithPill(fits)._fitPill();
  assert.ok(!fits.classes.has('dot') && !fits.classes.has('tight'));
  // Cut with the normal gaps, whole with the tighter ones: the label, tight, not the dot.
  const tight = fakePill(101, 95, 8);
  cardWithPill(tight)._fitPill();
  assert.ok(tight.classes.has('tight') && !tight.classes.has('dot'));
  // Measured again from the normal gaps at each call: room again, the normal gaps.
  tight.room = 110;
  cardWithPill(tight)._fitPill();
  assert.ok(!tight.classes.has('tight') && !tight.classes.has('dot'));
});

test('pill: a resize of a few pixels (no re-render) measures it again, both ways', () => {
  const pill = fakePill(101, 95);
  const card = cardWithPill(pill);
  card.connectedCallback();
  const ro = observers[observers.length - 1];
  ro.fire(240);
  nextFrame();
  card._fitPill();
  assert.ok(pill.classes.has('dot'));
  // 5 px wider: under the re-render step, but the label now fits.
  pill.room = 101;
  ro.fire(245);
  assert.ok(!pill.classes.has('dot'));
  pill.room = 99;
  ro.fire(242);
  assert.ok(pill.classes.has('dot'));
  card.disconnectedCallback();
});

test('contrast: coloured texts use an ink mixed with the text colour, ≥ 4.5:1 in light and dark', () => {
  for (const sel of ['.pill', '.gauge.low .gval', '.row.manual .txt .sub', '.chart text.now', '.tab.on', '.btn.accent']) {
    assert.match(rule(sel), /(color|fill): (var\(--ci\)|var\(--vc-ink\)|color-mix\(in srgb, var\(--[a-z-]+\) 40%, var\(--primary-text-color\)\))/, sel);
  }
  assert.match(rule('ha-card'), /--ci: color-mix\(in srgb, var\(--c\) 40%, var\(--primary-text-color\)\)/);
  // HA default colours: the state colours over the light / dark card with the pill tint.
  const themes = [
    { text: hex('#212121'), card: hex('#ffffff') },
    { text: hex('#e1e1e1'), card: hex('#1c1c1c') },
  ];
  for (const c of ['#03a9f4', '#43a047', '#ffa600', '#9e9e9e', '#f59e0b']) {
    for (const t of themes) {
      const ink = mix(hex(c), t.text, 0.4);
      const bg = mix(hex(c), t.card, 0.14);
      assert.ok(contrast(ink, bg) >= 4.5, `${c}: ${contrast(ink, bg).toFixed(2)}`);
    }
  }
});

test('plugin hybrid trips: one consumption a line, the value column never pushes the date out', () => {
  const card = makeCard();
  card._open = new Set(['trips']);
  card.hass = hassWith(
    fuelAttrs({
      kind: 'plugin_hybrid',
      trips: [{ start: '2026-10-30T08:00:00+01:00', distance: 42.3, fuel_consumption: 2.2, energy_consumption: 9.2, cost: 4.32 }],
    }),
  );
  assert.match(html(card), /<span class="val"><span class="v">2.2 L\/100 km<\/span><span class="v">9.2 kWh\/100 km<\/span><span class="sub">€4.32<\/span>/);
  const val = rule('.val');
  for (const p of ['flex: 0 1 auto', 'min-width: 0', 'max-width: 60%']) assert.ok(val.includes(p), p);
});

test('chart: drawn at the width of the card, so its labels keep their size', () => {
  const card = makeCard();
  card.hass = hassWith(fuelAttrs());
  assert.match(html(card), /viewBox="0 0 400 112"/);
  card.connectedCallback();
  const ro = observers.at(-1);
  assert.equal(ro.targets[0], card);
  ro.fire(230);
  nextFrame();
  // 230 px card: 12 px card padding and 10 px chart padding on each side.
  assert.match(html(card), /viewBox="0 0 186 112"/);
  card.shadowRoot.innerHTML = 'kept';
  ro.fire(232); // a few pixels do not re-render
  assert.equal(html(card), 'kept');
  card.disconnectedCallback();
  assert.equal(ro.targets.length, 0);
  // Twelve months on a narrow card: every other month name, the values only for the current month.
  const narrow = makeCard({ months: 12 });
  narrow.hass = hassWith(fuelAttrs());
  narrow.connectedCallback();
  observers.at(-1).fire(230);
  nextFrame();
  const out = html(narrow);
  assert.equal((out.match(/class="ml/g) || []).length, 6);
  assert.equal((out.match(/class="bv/g) || []).length, 1);
  narrow.disconnectedCallback();
});

test('resize: re-rendered at the next frame, never in the observer callback, once, only if the width changed', () => {
  // A render in the callback resized the observed card in the same frame: "ResizeObserver loop completed with
  // undelivered notifications" at every load.
  const card = makeCard();
  card.hass = hassWith(fuelAttrs());
  let renders = 0;
  const render = card._render.bind(card);
  card._render = () => {
    renders += 1;
    render();
  };
  card.connectedCallback();
  const ro = observers.at(-1);
  ro.fire(300);
  ro.fire(320);
  assert.equal(renders, 0);
  nextFrame();
  assert.equal(renders, 1);
  assert.match(html(card), /viewBox="0 0 276 112"/);
  // Out and back within one frame: nothing to render.
  ro.fire(400);
  ro.fire(321);
  nextFrame();
  assert.equal(renders, 1);
  // Removed before the frame: no render.
  ro.fire(500);
  card.disconnectedCallback();
  nextFrame();
  assert.equal(renders, 1);
});

test('not set up, unavailable or not found: each says so, with the sensor', () => {
  const missing = makeCard({ entity: 'sensor.typo' });
  missing.hass = hassWith(fuelAttrs());
  assert.match(html(missing), /class="ptxt">Not found</);
  assert.match(html(missing), /sensor\.typo is not a Vehicle Consumption sensor/);
  const down = makeCard({ entity: SENSOR });
  const hass = hassWith(null);
  hass.states[SENSOR] = { state: 'unavailable', attributes: { restored: true, friendly_name: 'Family car Consumption' } };
  down.hass = hass;
  assert.match(html(down), /class="ptxt">Unavailable</);
  assert.match(html(down), /sensor\.family_car_consumption is unavailable/);
  assert.doesNotMatch(html(down), /Settings → Devices/);
  const none = makeCard();
  none.hass = hassWith(null);
  assert.match(html(none), /Not set up/);
  assert.match(html(none), /Settings → Devices/);
});

test('no entity set, the only vehicle unavailable (Home Assistant starting): unavailable, not "Not set up"', () => {
  const down = (registry, states) => {
    const card = makeCard();
    const hass = hassWith(null);
    hass.entities = registry;
    hass.states = states;
    card.hass = hass;
    return html(card);
  };
  const restored = { state: 'unavailable', attributes: { restored: true, friendly_name: 'Family car Consumption' } };
  // The main sensor named by its translation key in the registry.
  const named = down(
    { 'sensor.family_car_distance_trip': { platform: 'vehicle_consumption', translation_key: 'distance_trip' }, [SENSOR]: { platform: 'vehicle_consumption', translation_key: 'consumption' } },
    { 'sensor.family_car_distance_trip': { state: '42.3', attributes: {} }, [SENSOR]: restored },
  );
  assert.match(named, /class="ptxt">Unavailable</);
  assert.match(named, /sensor\.family_car_consumption is unavailable/);
  assert.doesNotMatch(named, /Not set up/);
  // Without translation keys, every sensor of the integration down (unknown just after a start).
  const all = down(registry(), {
    'sensor.family_car_distance_trip': { state: 'unknown', attributes: {} },
    [SENSOR]: { ...restored, state: 'unknown' },
  });
  assert.match(all, /class="ptxt">Unavailable</);
  assert.doesNotMatch(all, /Not set up/);
  // A vehicle that works is still picked over one that is down.
  const card = makeCard();
  const hass = hassWith(fuelAttrs());
  hass.entities = { ...hass.entities, 'sensor.van_consumption': { platform: 'vehicle_consumption', translation_key: 'consumption' } };
  hass.states['sensor.van_consumption'] = { state: 'unavailable', attributes: {} };
  card.hass = hass;
  assert.doesNotMatch(html(card), /Unavailable/);
});

test('section count: the rows shown out of the total when the list is longer', () => {
  const trip = { start: '2026-10-30T08:00:00+01:00', distance: 10, fuel_consumption: 5, cost: 1 };
  const card = makeCard();
  card.hass = hassWith(fuelAttrs({ trips: Array.from({ length: 6 }, () => trip) }));
  assert.match(html(card), /data-key="trips"[\s\S]*?<span class="count">5\/6<\/span>/);
  const few = makeCard();
  few.hass = hassWith(fuelAttrs());
  assert.match(html(few), /data-key="trips"[\s\S]*?<span class="count">1<\/span>/);
});

test('KPIs on a narrow card: the unit goes under the value, labels and sub-lines wrap', () => {
  const css = styles();
  const at = css.search(/@container \(max-width: \d+px\) \{[^@]*\.kv small/);
  assert.ok(at >= 0);
  const block = css.slice(at, css.indexOf('} }', at));
  assert.match(block, /\.kv small \{ display: block; margin-left: 0; \}/);
  assert.match(block, /\.kl, \.ks \{ white-space: normal;/);
});

test('editor: the chart options are hidden while the chart is off', () => {
  const editor = new VehicleConsumptionCardEditor();
  editor.appendChild = () => {};
  editor.dispatchEvent = () => {};
  editor.setConfig({ type: 'custom:vehicle-consumption-card' });
  editor.hass = hassWith(fuelAttrs());
  const names = () => editor._form.schema.map((s) => s.name);
  assert.ok(names().includes('chart_metric') && names().includes('months'));
  editor.setConfig({ type: 'custom:vehicle-consumption-card', chart: false });
  assert.ok(!names().includes('chart_metric') && !names().includes('months'));
  assert.ok(names().includes('chart'));
});

test('times follow the 12 / 24 h setting of Home Assistant', () => {
  const d = '2026-10-30T17:05:00Z';
  const at = (time_format, lang = 'en') =>
    vcFormat({ locale: { language: lang, time_format, time_zone: 'server' } }, lang, 'EUR').date(d).replace(/\s/g, ' ');
  const h24 = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(d));
  const h12 = new Intl.DateTimeFormat('fr', { hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(d));
  assert.ok(at('24').endsWith(h24), at('24'));
  assert.doesNotMatch(at('24'), /PM/);
  assert.ok(at('12', 'fr').replace(/\s/g, ' ').endsWith(h12.replace(/\s/g, ' ')), at('12', 'fr'));
  assert.match(at('language'), /PM/);
});

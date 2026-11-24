// ── Editor ───────────────────────────────────────────────────────────────────
import { pickerDefine } from "./card-picker.js";
import { VC_DEFAULTS, VC_METRICS, VEHICLE_CONSUMPTION_CARD_VERSION, vcLang, vcT, vcVehicleName, vcVehicles } from "./core.js";
import { VehicleConsumptionCard } from "./card.js";
import { VehicleConsumptionMiniCard } from "./mini-card.js";

export const VC_HELPERS = ['entity', 'title', 'language'];

export class VehicleConsumptionCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._update();
  }

  set hass(hass) {
    this._hass = hass;
    this._update();
  }

  _update() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement('ha-form');
      const t = (key) => vcT(vcLang(this._hass, this._config), key);
      this._form.computeLabel = (s) => t(`ed_${s.name}`);
      this._form.computeHelper = (s) => (VC_HELPERS.includes(s.name) ? t(`ed_${s.name}_helper`) : undefined);
      this._form.addEventListener('value-changed', (ev) => {
        const config = { ...ev.detail.value };
        // Options left at their default are not written to the YAML.
        for (const k of Object.keys(config)) {
          if (config[k] === '' || config[k] == null || VC_DEFAULTS[k] === config[k]) delete config[k];
        }
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    const c = this._config;
    const lang = vcLang(this._hass, c);
    // Reassigning the schema at every Home Assistant update would re-render ha-form while the user is typing.
    // The vehicles found, plus a configured sensor that is not (yet) among them, so the choice is never lost.
    const vehicles = vcVehicles(this._hass).map((v) => ({ value: v.entity, label: v.name }));
    if (c.entity && !vehicles.some((v) => v.value === c.entity)) {
      vehicles.push({ value: c.entity, label: vcVehicleName(this._hass.states?.[c.entity], c.entity) });
    }
    const key = JSON.stringify(vehicles);
    if (this._deps && this._deps.config === c && this._deps.lang === lang && this._deps.key === key) return;
    this._deps = { config: c, lang, key };
    this._form.data = { ...VC_DEFAULTS, ...c };
    this._form.schema = [
      { name: 'entity', selector: { select: { mode: 'dropdown', options: vehicles } } },
      { name: 'title', selector: { text: {} } },
      { name: 'show_title', selector: { boolean: {} } },
      { name: 'illustration', selector: { boolean: {} } },
      // The picture's day / night only matters with the picture.
      ...(c.illustration === false
        ? []
        : [
            {
              name: 'illustration_theme',
              selector: {
                select: { mode: 'dropdown', options: ['auto', 'day', 'night'].map((v) => ({ value: v, label: vcT(lang, `theme_${v}`) })) },
              },
            },
          ]),
      { name: 'chart', selector: { boolean: {} } },
      // What the chart shows only matters with the chart.
      ...(c.chart === false
        ? []
        : [
            {
              name: 'chart_metric',
              selector: {
                select: { mode: 'dropdown', options: VC_METRICS.map((m) => ({ value: m, label: vcT(lang, `chart_${m}`) })) },
              },
            },
            { name: 'months', selector: { number: { min: 3, max: 12, mode: 'slider' } } },
          ]),
      { name: 'trips', selector: { boolean: {} } },
      { name: 'refuels', selector: { boolean: {} } },
      { name: 'lease', selector: { boolean: {} } },
      { name: 'add_button', selector: { boolean: {} } },
      ...(this.constructor.mini ? [{ name: 'zoom', selector: { boolean: {} } }] : []),
      {
        name: 'language',
        selector: {
          select: {
            mode: 'dropdown',
            options: [
              { value: 'en', label: 'English' },
              { value: 'fr', label: 'Français' },
              { value: 'de', label: 'Deutsch' },
              { value: 'es', label: 'Español' },
              { value: 'it', label: 'Italiano' },
              { value: 'nl', label: 'Nederlands' },
              { value: 'pt', label: 'Português (Portugal)' },
              { value: 'pl', label: 'Polski' },
              { value: 'ro', label: 'Română' },
              { value: 'da', label: 'Dansk' },
              { value: 'sv', label: 'Svenska' },
              { value: 'bg', label: 'Български' },
              { value: 'ru', label: 'Русский' },
              { value: 'uk', label: 'Українська' },
              { value: 'hu', label: 'Magyar' },
              { value: 'sk', label: 'Slovenčina' },
              { value: 'cs', label: 'Čeština' },
              { value: 'sl', label: 'Slovenščina' },
              { value: 'lv', label: 'Latviešu' },
              { value: 'el', label: 'Ελληνικά' },
              { value: 'sr', label: 'Српски' },
              { value: 'sr-Latn', label: 'Srpski (latinica)' },
            ],
          },
        },
      },
    ];
  }
}

export class VehicleConsumptionMiniCardEditor extends VehicleConsumptionCardEditor {
  static get mini() {
    return true;
  }
}

// The card picker's language: Home Assistant's (its element, else the language it keeps), else the browser's.
export function vcPickerLang() {
  let stored = null;
  try {
    stored = JSON.parse(window.localStorage?.getItem('selectedLanguage') || 'null');
  } catch {
    stored = null;
  }
  const hass = document.querySelector?.('home-assistant')?.hass;
  return vcLang({ language: hass?.locale?.language || hass?.language || stored || globalThis.navigator?.language }, {});
}

// Loaded twice (resource and extra JS URL): the second copy registers and logs nothing.
export const vcFirstLoad = !customElements.get('vehicle-consumption-card');
export const vcDefine = (name, cls) => {
  if (!customElements.get(name)) pickerDefine(name, cls);
};
vcDefine('vehicle-consumption-card', VehicleConsumptionCard);
vcDefine('vehicle-consumption-card-editor', VehicleConsumptionCardEditor);
vcDefine('vehicle-consumption-mini-card', VehicleConsumptionMiniCard);
vcDefine('vehicle-consumption-mini-card-editor', VehicleConsumptionMiniCardEditor);

window.customCards = window.customCards || [];
{
  const lang = vcPickerLang();
  for (const [type, name, description] of [
    ['vehicle-consumption-card', 'card_name', 'card_desc'],
    ['vehicle-consumption-mini-card', 'mini_name', 'mini_desc'],
  ]) {
    if (window.customCards.some((card) => card.type === type)) continue;
    window.customCards.push({
      type,
      name: vcT(lang, name),
      description: vcT(lang, description),
      preview: true,
      documentationURL: 'https://github.com/juju35/ha-vehicle-consumption',
    });
  }
}
if (vcFirstLoad) {
  console.info(
    `%c VEHICLE-CONSUMPTION-CARD %c v${VEHICLE_CONSUMPTION_CARD_VERSION} `,
    'background:#0ea5e9;color:#fff;font-weight:700',
    '',
  );
}

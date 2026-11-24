import { VC_ANIM_MS, VC_DASH, VC_DEFAULTS, VC_ICON, VC_KINDS, VC_LOW, VC_METRICS, VC_ROWS, vcDown, vcEsc, vcFinite, vcFormat, vcLang, vcMonthKeys, vcParse, vcPick, vcSections, vcT, vcTracks, vcUnits } from "./core.js";
import { VC_BANNER_STYLE, VC_GRADE, vcIsNight, vcMorph, vcSceneSvg } from "./illustrated-header.js";

export let vcUid = 0;

export class VehicleConsumptionCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement('vehicle-consumption-card-editor');
  }

  // The card picker's preview shows a real vehicle when there is one.
  static getStubConfig(hass) {
    const entity = vcPick(hass);
    return entity ? { entity } : {};
  }

  constructor() {
    super();
    this._open = new Set();
    this._uid = ++vcUid;
    // "A click elsewhere" is caught on the pointer too: on iOS (Safari and the companion app) a tap on something
    // that is not clickable (the background, an empty spot) sends no click to the page. A section stays open when
    // the press or the release is in it (a scroll cancels the pointer); keyboard clicks (no click count) come as
    // click events.
    this._onDocDown = (ev) => {
      this._downSections = vcSections(ev);
    };
    this._onDocUp = (ev) => {
      this._foldOutside(ev, this._downSections);
      this._downSections = null;
    };
    this._onDocClick = (ev) => {
      if (!ev?.detail) this._foldOutside(ev);
    };
    this._onKey = (ev) => {
      if (ev.key === 'Escape' && this._popup) this._closePopup();
      else if (ev.key === 'Tab' && this._popup) this._trapTab(ev);
    };
  }

  setConfig(config) {
    this._config = { ...VC_DEFAULTS, ...config };
    // show_title: the header's title, hidden by the stylesheet (the driving chip stays)
    this.toggleAttribute?.('hide-title', config.show_title === false);
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this._sig = null;
    this._render();
  }

  set hass(hass) {
    const old = this._hass;
    this._hass = hass;
    // Nothing the card shows can have changed: same sensor state object, same registry, same language and locale.
    const entity = this._entity;
    if (
      old &&
      this._sig &&
      entity &&
      hass.states[entity] === old.states[entity] &&
      hass.entities === old.entities &&
      hass.locale === old.locale &&
      vcLang(hass, this._config) === vcLang(old, this._config) &&
      vcIsNight(hass, this._config) === vcIsNight(old, this._config)
    ) {
      return;
    }
    this._render();
  }

  connectedCallback() {
    document.addEventListener('pointerdown', this._onDocDown, true);
    document.addEventListener('pointerup', this._onDocUp, true);
    document.addEventListener('click', this._onDocClick);
    // Back on the page after leaving it: drawn again in its default state (see disconnectedCallback).
    if (this._sig === null) this._render();
    // The chart is drawn at the card's width (its labels keep their size); a few pixels do not re-render.
    if (typeof ResizeObserver === 'function') {
      this._ro ??= new ResizeObserver((entries) => {
        const width = Math.round(entries[entries.length - 1]?.contentRect?.width || 0);
        // The last width seen: a frame already asked for renders at it, or not at all if it came back.
        if (width > 0) this._nextWidth = width;
        if (width > 0 && Math.abs(width - (this._width || 0)) >= 8) {
          // Re-rendered at the next frame, not in this callback: a re-render there resizes what is observed in the
          // same frame ("ResizeObserver loop completed with undelivered notifications", at every load). Several
          // resizes in one frame: one render, at the last width, and none if it came back to the rendered one.
          this._frame ||= requestAnimationFrame(() => {
            this._frame = 0;
            if (Math.abs(this._nextWidth - (this._width || 0)) < 8) return;
            this._width = this._nextWidth;
            this._render();
          });
        } else {
          // A few pixels: no re-render, but the pill's label may now fit, or no longer.
          this._fitPill();
        }
      });
      this._ro.observe(this);
    }
    document.fonts?.ready?.then(() => this._fitPill());
  }

  disconnectedCallback() {
    this._ro?.disconnect();
    if (this._frame) cancelAnimationFrame(this._frame);
    this._frame = 0;
    document.removeEventListener('pointerdown', this._onDocDown, true);
    document.removeEventListener('pointerup', this._onDocUp, true);
    document.removeEventListener('click', this._onDocClick);
    document.removeEventListener('keydown', this._onKey);
    // Left (another view, a conditional card hidden): the popup closes without saving and the sections fold back,
    // so that the card does not come back with them open.
    this._popup = null;
    this._refocus = false;
    this._open.clear();
    this._sig = null;
  }

  getCardSize() {
    const c = this._config || {};
    return 4 + (c.chart !== false ? 3 : 0) + (c.trips !== false ? 1 : 0) + (c.refuels !== false ? 1 : 0);
  }

  getGridOptions() {
    // 8 of 12 columns: about 208 px in a phone's section, the narrowest where the figures and the pill still fit (at
    // 6, about 156 px, the consumption values are cut and the pill leaves the card while driving).
    return { columns: 12, min_columns: 8, rows: 'auto' };
  }

  // Compact view (the mini card until its detail button is pressed): header, gauges, last trip and average.
  _compact() {
    return false;
  }

  // The mini card's detail button: none on the full card.
  _zoomButton() {
    return '';
  }

  _zoomClick() {}

  _t(key, vars) {
    return vcT(vcLang(this._hass, this._config), key, vars);
  }

  // The main sensor: the configured one, else the first vehicle found (by name), else one that is down (so the card
  // says it is unavailable, not that nothing is set up). The registry scan is kept until
  // hass.entities changes; the states are read again each time.
  _lookup() {
    return this._config.entity || vcPick(this._hass) || vcDown(this._hass);
  }

  _render(force = false) {
    if (!this._config || !this._hass || !this.shadowRoot) return;
    const c = this._config;
    const entity = this._lookup();
    const st = entity ? this._hass.states[entity] : undefined;
    const a = Array.isArray(st?.attributes?.months) ? st.attributes : null;
    const lang = vcLang(this._hass, c);
    const compact = this._compact();
    const sig = JSON.stringify([c, lang, this._hass.locale, entity, st?.state, a, [...this._open], this._popup?.mode, !!this._popup, this._width, compact, this._illustrated() && vcIsNight(this._hass, c)]);
    this._entity = entity;
    if (!force && sig === this._sig) return;
    // The popup is being filled in: the update waits until it closes, so typing is never interrupted.
    if (this._popup && !force) {
      this._stale = true;
      return;
    }
    this._sig = sig;
    this._stale = false;
    this._attrs = a;

    if (!a) {
      // No vehicle found at all: not set up. A configured sensor: unavailable (starting, reloading) or not found
      // (a typo, another sensor, a vehicle removed).
      const why = !entity ? 'not_loaded' : st && ['unavailable', 'unknown'].includes(st.state) ? 'unavailable' : 'not_found';
      vcMorph(this.shadowRoot, `
      <style>${VehicleConsumptionCard.styles}</style>
      <ha-card class="lvl-na${this.hasAttribute?.('mini') ? ' mini' : ''}">
        ${
          this._illustrated()
            ? this._banner({ level: 'na', kind: 'fuel', name: c.title || this._t('title'), pill: this._t(why), scene: this._sceneData(null, 'fuel', null, 'na') })
            : `<div class="head">
          <div class="badge"><ha-icon icon="${VC_ICON}"></ha-icon></div>
          <div class="htxt titles"><div class="trow"><div class="title"><span class="tname">${vcEsc(c.title || this._t('title'))}</span></div>${this._pill(this._t(why))}</div></div>
        </div>`
        }
        <div class="empty">${vcEsc(this._t(`${why}_hint`, { entity }))}</div>
      </ha-card>`);
      this._fitPill();
      this._fitWhenRendered();
      return;
    }

    const f = vcFormat(this._hass, lang, a.currency);
    const kind = VC_KINDS.includes(a.kind) ? a.kind : 'fuel';
    const tracks = vcTracks(kind);
    const gauges = [
      tracks.fuel ? this._gauge('fuel', a.fuel_level, a.fuel_quantity, vcUnits(a).vol, 'mdi:gas-station', f) : null,
      tracks.energy ? this._gauge('battery', a.battery_level, a.battery_energy, 'kWh', 'mdi:battery-charging-medium', f) : null,
    ].filter(Boolean);
    const low = gauges.some((g) => g.low);
    const level = a.driving ? 'drive' : low ? 'warn' : 'ok';
    // The sensor keeps its metric unit (statistics): with imperial units, its figure in mpg / mi/kWh is an attribute.
    const imperial = 'imperial_value' in a;
    const value = imperial ? a.imperial_value : st.state;
    const unit = (imperial && a.imperial_unit) || st.attributes.unit_of_measurement || (tracks.fuel ? vcUnits(a).fuel : vcUnits(a).energy);
    const avg = vcFinite(value) ? `${f.num(value, 1)} ${unit}` : VC_DASH;

    // First-render animations: started at the first render, resumed (negative delay) by a re-render inside the window.
    this._born ??= Date.now();
    const elapsed = Date.now() - this._born;
    const anim = elapsed < VC_ANIM_MS ? ` anim" style="--vc-t:${-elapsed}ms` : '';

    const add =
      !compact && c.add_button !== false && a.entry_id
        ? `<button class="icon-btn add" title="${vcEsc(this._t('add'))}" aria-label="${vcEsc(this._t('add'))}"><ha-icon icon="mdi:plus"></ha-icon></button>`
        : '';
    const driving = a.driving
      ? `<span class="drive" title="${vcEsc(this._t('driving'))}" aria-label="${vcEsc(this._t('driving'))}"></span>`
      : '';

    // Patched in place, not written again: the scene, the chart and the gauges keep their nodes and the card its
    // height on a state update (the page does not jump).
    vcMorph(this.shadowRoot, `
      <style>${VehicleConsumptionCard.styles}</style>
      <ha-card class="lvl-${level}${this.hasAttribute?.('mini') ? ' mini' : ''}${this._popup ? ' has-popup' : ''}${anim}">
        ${
          this._illustrated()
            ? this._banner({ level, kind, name: c.title || a.vehicle || this._t('title'), pill: avg, sub: this._t(a.driving ? 'driving' : 'average'), driving, buttons: add + this._zoomButton(), scene: this._sceneData(a, kind, f, level) })
            : `<div class="head">
          <div class="badge"><ha-icon icon="${VC_ICON}"></ha-icon></div>
          <div class="htxt titles"><div class="trow"><div class="title"><span class="tname">${vcEsc(c.title || a.vehicle || this._t('title'))}</span>${driving}</div>${this._pill(avg)}</div></div>
          ${add}
          ${this._zoomButton()}
        </div>`
        }
        <div class="gauges">${gauges.map((g) => g.html).join('')}</div>
        <div class="kpis">${this._kpis(a, kind, f, compact)}</div>
        ${!compact && c.chart !== false ? this._chart(a, kind, f) : ''}
        ${compact ? '' : this._sections(a, kind, f)}
        ${this._popup && !compact ? this._popupHtml(a, kind, f) : ''}
      </ha-card>`);

    this._bind();
    this._fitPill();
    this._fitWhenRendered();
  }

  _illustrated() {
    return this._config?.illustration !== false;
  }

  // A new <ha-card> (first render) lays its content out only once it has rendered (a microtask later, Lit): the
  // pill is measured then again, otherwise it keeps a place measured at 0 px.
  _fitWhenRendered() {
    const hc = this.shadowRoot?.querySelector?.('ha-card');
    if (!hc?.updateComplete || hc._vcFitWait) return;
    hc._vcFitWait = true;
    hc.updateComplete.then(() => this._fitPill());
  }

  // The illustrated header: the round icon (fuel pump or charging station, coloured by the card's level) with the
  // title, the pill (the average, in the level's colour) right after it and what the pill is under it, on the sky;
  // the scene at the right, the road strip under it; the buttons at the banner's top right corner.
  _banner({ level, kind, name, pill, sub = '', driving = '', buttons = '', scene }) {
    const icon = kind === 'electric' ? 'mdi:ev-station' : 'mdi:gas-station';
    const night = vcIsNight(this._hass, this._config);
    const cls = `banner lvl-${level} k-${kind === 'electric' ? 'ev' : 'fuel'}${night ? ' night' : ''}`;
    // The scene keeps clear of the header buttons: it moves left so that the pump's body ends 2 px left of them
    // (each button 24 px, 4 px apart, 5 px from the edge; the pump's body ends 13 px left of the scene's edge, its
    // hose and nozzle stay low, under the buttons).
    const n = (buttons.match(/<button/g) || []).length;
    const shift = n ? `--vc-sr: ${28 * n - 7}px;` : '';
    return `<div class="${cls}" data-uid="${this._uid}"${shift ? ` style="${shift}"` : ''}>
          <div class="vc-road" aria-hidden="true"></div>
          ${vcSceneSvg(scene)}
          <div class="head">
            <div class="badge"><ha-icon icon="${icon}"></ha-icon></div>
            <div class="htxt titles">
              <div class="trow"><div class="title"><span class="tname">${vcEsc(name)}</span>${driving}</div>${pill ? this._pill(pill) : ''}</div>
              ${sub ? `<div class="hsub" title="${vcEsc(sub)}">${vcEsc(sub)}</div>` : ''}
            </div>
          </div>
          ${buttons ? `<div class="hbtns">${buttons}</div>` : ''}
        </div>`;
  }

  // What the scene shows: the last 7 months' consumption of the main energy and its average, the last refuel or
  // charge (amount · cost), the tank or battery on the pump's screen.
  _sceneData(a, kind, f, level) {
    const ev = kind === 'electric';
    const primary = ev ? 'energy' : 'fuel';
    const u = vcUnits(a);
    const months = Array.isArray(a?.months) ? a.months : [];
    const byKey = new Map(months.map((m) => [m?.month, m]));
    const keys = vcMonthKeys(a?.month?.month || months[months.length - 1]?.month, 7);
    const bars = keys.map((k) => {
      const v = byKey.get(k)?.[`${primary}_consumption`];
      return vcFinite(v) ? Number(v) : null;
    });
    let calc = '';
    let screen = '--';
    if (a && f) {
      const ev0 = (ev ? a.charges : a.refuels)?.[0];
      const amount = ev0?.[ev ? 'energy' : 'liters'];
      if (vcFinite(amount)) {
        calc = [`${f.num(amount, 1)} ${ev ? 'kWh' : u.vol}`, vcFinite(ev0.cost) ? f.money(ev0.cost) : ''].filter(Boolean).join(' · ');
      }
      if (ev) {
        if (vcFinite(a.battery_level)) screen = `${f.num(a.battery_level, 0)}%`;
      } else if (vcFinite(a.fuel_quantity)) {
        const q = `${f.num(a.fuel_quantity, Number(a.fuel_quantity) < 100 ? 1 : 0)}`;
        screen = q.length + u.vol.length <= 5 ? `${q}${u.vol}` : q;
      } else if (vcFinite(a.fuel_level)) {
        screen = `${f.num(a.fuel_level, 0)}%`;
      }
    }
    return {
      ev,
      hybrid: kind === 'plugin_hybrid',
      bars,
      avg: a?.total?.[`${primary}_consumption`],
      unit: ev ? u.energy : u.fuel,
      calc,
      screen,
      grade: VC_GRADE[a?.fuel_type] || VC_GRADE.petrol,
      level,
    };
  }

  // The header pill: its text, or only its coloured dot on a narrow card (the text stays in the tooltip and label).
  _pill(text) {
    const t = vcEsc(text);
    return `<div class="pill" title="${t}" aria-label="${t}"><span class="pdot"></span><span class="ptxt">${t}</span></div>`;
  }

  // The status pill goes right after the title only when the whole title and the pill's whole label fit on that row;
  // otherwise it takes a line of its own under the subtitle (.titles.below, the subtitle cut to one line). In the
  // banner (where that line may run over the picture), when the titles still run below the top of the ground strip or
  // out of the banner, and in the classic header when the label does not fit even alone, the pill keeps its dot alone,
  // beside the title (.titles.dotonly). Measured in fractional pixels.
  _fitPill() {
    for (const t of this.shadowRoot?.querySelectorAll?.('.titles') || []) {
      const row = t.querySelector('.trow');
      const chips = row ? [...row.querySelectorAll(':scope > .pill')] : [];
      if (!chips.length || !row.getBoundingClientRect) continue;
      t.classList.remove('below', 'dotonly');
      const name = row.querySelector(':scope > .title');
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      const widths = chips.map((c) => c.getBoundingClientRect().width);
      let need = -gap;
      if (name && getComputedStyle(name).display !== 'none') {
        name.style.flex = 'none';
        need = name.getBoundingClientRect().width;
        name.style.flex = '';
      }
      for (const w of widths) need += gap + w;
      const room = row.getBoundingClientRect().width + 0.01;
      if (need <= room) continue;
      t.classList.add('below');
      const banner = t.closest('.banner');
      const cut = !banner && widths.some((w) => w > room);
      let out = false;
      if (banner) {
        const b = banner.getBoundingClientRect();
        const floor = b.bottom - (banner.querySelector('.vc-road')?.getBoundingClientRect().height ?? 10) + 0.5;
        out = [...t.querySelectorAll('.title, .hsub, .pill')].some((e) => {
          const r = e.getBoundingClientRect();
          return r.height && (r.bottom > floor || r.top < b.top - 0.5 || r.right > b.right + 0.5);
        });
      }
      if (cut || out) t.classList.replace('below', 'dotonly');
    }
  }

  // The card's buttons and fields, listened once on the shadow root: the patched nodes are kept from one render to
  // the next, so listeners added to them at each render would pile up.
  _listen() {
    const root = this.shadowRoot;
    if (!root?.addEventListener || root._vcListening) return;
    root._vcListening = true;
    root.addEventListener('click', (ev) => {
      const el = ev.target?.closest?.('.add, .zoom, .fold, .lswap, [data-act], [data-mode]');
      if (!el) return;
      if (el.matches('.add')) this._openPopup();
      else if (el.matches('.zoom')) this._zoomClick(ev);
      else if (el.matches('.fold')) this._toggle(el.dataset.key);
      else if (el.matches('.lswap')) {
        // The lease allowance: the gauge or the curve.
        this._leaseCurve = !this._leaseCurve;
        this._render(true);
      }
      else if (!this._popup) return;
      else if (el.dataset.act) (el.dataset.act === 'save' ? this._save() : this._closePopup());
      else this._setMode(el.dataset.mode);
    });
    // In the capture phase: an input event that does not bubble (dispatched by a script) still reaches it.
    root.addEventListener('input', (ev) => {
      const el = ev.target;
      if (this._popup && el?.localName === 'input') this._input(el.name, el.value);
    }, true);
    root.addEventListener('keydown', (ev) => {
      if (this._popup && ev.target?.localName === 'input' && ev.key === 'Enter') this._save();
    }, true);
  }

  _bind() {
    const root = this.shadowRoot;
    this._listen();
    if (!this._popup) return;
    // The amount, ready to type in, without scrolling the dashboard to the card (a re-render: mode, error); the
    // opening brings the popup into view itself (`_openPopup`).
    root.querySelector('input[name="amount"]')?.focus?.({ preventScroll: true });
  }

  // A tank or battery gauge: { html, low }.
  _gauge(key, levelValue, amount, unit, icon, f) {
    const hasLevel = vcFinite(levelValue);
    const pct = hasLevel ? Math.max(0, Math.min(100, Number(levelValue))) : null;
    const low = hasLevel && pct < VC_LOW;
    const parts = [hasLevel ? `${f.num(pct, 0)} %` : '', vcFinite(amount) ? `${f.num(amount, 1)} ${unit}` : ''].filter(Boolean);
    const html = `
          <div class="gauge g-${key}${low ? ' low' : ''}">
            <span class="ic"><ha-icon icon="${icon}"></ha-icon></span>
            <span class="glabel">${vcEsc(this._t(key))}</span>
            <span class="gval">${vcEsc(parts.join(' · ') || VC_DASH)}</span>
            <span class="track"><span class="fill" style="width:${pct ?? 0}%"></span></span>
          </div>`;
    return { html, low };
  }

  // One consumption per tracked energy: [{ v, unit }].
  _cons(obj, kind, f) {
    const t = vcTracks(kind);
    const u = vcUnits(this._attrs);
    return [
      t.fuel ? { v: f.num(obj?.fuel_consumption, 1), unit: u.fuel } : null,
      t.energy ? { v: f.num(obj?.energy_consumption, 1), unit: u.energy } : null,
    ].filter(Boolean);
  }

  _kpi(cls, label, icon, lines, sub, echo = '') {
    const values = lines
      .map((l) => `<span class="kv">${vcEsc(l.v)}${l.v === VC_DASH || !l.unit ? '' : `<small>${vcEsc(l.unit)}</small>`}</span>`)
      .join('');
    return `
          <div class="kpi ${cls}">
            <span class="kl"><ha-icon icon="${icon}"></ha-icon>${vcEsc(label)}</span>
            ${values}
            <span class="ks">${vcEsc(sub || VC_DASH)}</span>${echo ? `
            <span class="ks pill-echo">${vcEsc(`${this._t('average')} ${echo}`)}</span>` : ''}
          </div>`;
  }

  // The compact view keeps the last trip and the average.
  _kpis(a, kind, f, compact = false) {
    const u = vcUnits(a);
    const km = (v) => (vcFinite(v) ? `${f.num(v, Number(v) < 100 ? 1 : 0)} ${u.dist}` : '');
    const trip = a.trip || {};
    const tripSub = [km(trip.distance), vcFinite(trip.cost) ? f.money(trip.cost) : ''].filter(Boolean).join(' · ');
    const month = a.month || {};
    const total = a.total || {};
    const cpk = vcFinite(total.cost_per_km) ? total.cost_per_km : month.cost_per_km;
    const tripKpi = this._kpi('k-trip', this._t(a.driving ? 'trip_now' : 'trip'), 'mdi:map-marker-distance', this._cons(trip, kind, f), tripSub);
    // The average is the header pill's figure: in its place the odometer, with the distance tracked under it (and the
    // average, shown only when the pill keeps just its dot). A plug-in hybrid keeps its two averages (the pill gives one).
    const avgKpi =
      kind !== 'plugin_hybrid' && vcFinite(a.odometer)
        ? this._kpi(
            'k-odo',
            this._t('odometer'),
            'mdi:counter',
            [{ v: f.num(a.odometer, 0), unit: u.dist }],
            vcFinite(total.distance) ? this._t('tracked', { v: km(total.distance) }) : '',
            this._cons(total, kind, f)
              .map((l) => `${l.v} ${l.unit}`)
              .join(' · '),
          )
        : this._kpi('k-avg', this._t('average'), 'mdi:chart-line', this._cons(total, kind, f), km(total.distance));
    if (compact) return tripKpi + avgKpi;
    return [
      tripKpi,
      this._kpi('k-month', this._t('month'), 'mdi:calendar-month-outline', this._cons(month, kind, f), km(month.distance)),
      avgKpi,
      this._kpi(
        'k-cost',
        this._t('cost_km', { u: u.dist }),
        'mdi:cash',
        [{ v: f.money(cpk, 3), unit: vcFinite(cpk) ? `/${u.dist}` : '' }],
        // The month's cost, and the CO₂ per km of the whole period when the integration gives it.
        [
          vcFinite(month.cost) ? this._t('month_cost', { v: f.money(month.cost) }) : '',
          vcFinite(total.co2_per_km) ? this._t('co2_km', { v: f.num(total.co2_per_km, 0), u: u.dist }) : '',
        ]
          .filter(Boolean)
          .join(' · '),
      ),
    ].join('');
  }

  // The monthly bar chart, inline SVG: the last `months` months, the current one in the accent colour, the months
  // without data as faint stubs.
  _chart(a, kind, f) {
    const c = this._config;
    const n = Math.max(3, Math.min(12, Math.round(Number(c.months)) || VC_DEFAULTS.months));
    const metric = VC_METRICS.includes(c.chart_metric) ? c.chart_metric : 'consumption';
    const primary = kind === 'electric' ? 'energy' : 'fuel';
    const months = Array.isArray(a.months) ? a.months : [];
    const last = a.month?.month || months[months.length - 1]?.month;
    const keys = vcMonthKeys(last, n);
    const byKey = new Map(months.map((m) => [m?.month, m]));
    const metricOf = (m) =>
      metric === 'distance' ? m?.distance : metric === 'cost' ? m?.cost : metric === 'co2' ? m?.co2 : m?.[`${primary}_consumption`];
    const values = keys.map((k) => (vcFinite(metricOf(byKey.get(k))) ? Number(metricOf(byKey.get(k))) : null));
    const max = Math.max(0, ...values.filter((v) => v != null));
    const u = vcUnits(a);
    const unit =
      metric === 'distance' ? u.dist : metric === 'cost' ? a.currency || '' : metric === 'co2' ? 'kg CO₂' : u[primary];
    const label = (v) =>
      metric === 'cost' ? f.money(v, 0) : metric === 'distance' || metric === 'co2' ? f.num(v, 0) : f.num(v, 1);
    // The card's width less its padding (12 px) and the chart's (10 px), so 1 unit is 1 px; 400 until measured.
    const W = this._width ? Math.max(160, Math.min(1200, this._width - 44)) : 400;
    const top = 16;
    const plot = 78;
    const base = top + plot;
    const H = base + 18;
    const slot = W / n;
    const bw = Math.min(30, slot * 0.58);
    // Narrow slots: every other month name (the current one kept). Every bar has its value as long as the longest one
    // fits its slot (about 0.6 em a character, tabular figures), down to 8 px; narrower, the current month's only.
    const named = (i) => slot >= 24 || (n - 1 - i) % 2 === 0;
    const longest = Math.max(1, ...values.map((v) => (v != null && v > 0 ? label(v).length : 0)));
    const fs = Math.min(9.5, (slot - 2) / (longest * 0.6));
    const valued = (i) => fs >= 8 || i === n - 1;
    const vstyle = fs >= 8 && fs < 9.5 ? ` style="font-size:${fs.toFixed(1)}px"` : '';
    const bars = keys
      .map((k, i) => {
        const v = values[i];
        const x = i * slot + (slot - bw) / 2;
        const cx = (i * slot + slot / 2).toFixed(1);
        const now = i === n - 1;
        const name = f.month(k);
        if (v == null || v <= 0 || max <= 0) {
          return `<g class="col"><rect class="bar stub" x="${x.toFixed(1)}" y="${base - 3}" width="${bw.toFixed(1)}" height="3" rx="1.5"><title>${vcEsc(`${name}: ${VC_DASH}`)}</title></rect>
            ${named(i) ? `<text class="ml${now ? ' now' : ''}" x="${cx}" y="${H - 4}">${vcEsc(name)}</text>` : ''}</g>`;
        }
        const h = Math.max(4, (v / max) * plot);
        return `<g class="col"><rect class="bar${now ? ' now' : ''}" style="--i:${i}" x="${x.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="4"><title>${vcEsc(`${name}: ${label(v)} ${metric === 'cost' ? '' : unit}`.trim())}</title></rect>
            ${valued(i) ? `<text class="bv${now ? ' now' : ''}"${vstyle} x="${cx}" y="${(base - h - 4).toFixed(1)}">${vcEsc(label(v))}</text>` : ''}
            ${named(i) ? `<text class="ml${now ? ' now' : ''}" x="${cx}" y="${H - 4}">${vcEsc(name)}</text>` : ''}</g>`;
      })
      .join('');
    return `
        <div class="chart">
          <div class="chead"><span class="ctitle">${vcEsc(this._t(`chart_${metric}`))}<small>${vcEsc(unit)}</small></span>
            <span class="cspan">${vcEsc(this._t('last_months', { n }))}</span></div>
          <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${vcEsc(this._t(`chart_${metric}`))}">
            <line class="base" x1="0" x2="${W}" y1="${base + 0.5}" y2="${base + 0.5}"></line>
            ${bars}
          </svg>
        </div>`;
  }

  _sections(a, kind, f) {
    const c = this._config;
    const u = vcUnits(a);
    const out = [];
    if (c.trips !== false) {
      // The trip being driven first: it only joins the list once `trip_gap` has passed without a move.
      const open = a.driving && a.trip && vcFinite(a.trip.distance) && a.trip.distance > 0 ? [{ ...a.trip, open: true }] : [];
      const all = [...open, ...(Array.isArray(a.trips) ? a.trips : [])];
      const rows = all.slice(0, VC_ROWS).map((t) => {
        // A plug-in hybrid has two: one a line, so the column stays narrow.
        const cons = this._cons(t, kind, f)
          .filter((l) => l.v !== VC_DASH)
          .map((l) => `${l.v} ${l.unit}`);
        // A trip whose use a coarse sensor (whole litres) could not measure: estimated by the integration, marked so.
        const sub = [
          vcFinite(t.distance) ? `${f.num(t.distance, 1)} ${u.dist}` : '',
          t.open ? this._t('driving') : '',
          t.estimated ? `≈ ${this._t('estimated')}` : '',
        ]
          .filter(Boolean)
          .join(' · ');
        return this._row(f.date(t.start), sub || VC_DASH, cons.length ? cons : VC_DASH, f.money(t.cost));
      });
      // The count of everything kept (a year): the list only holds the newest.
      const count = open.length + (vcFinite(a.trip_count) ? a.trip_count : all.length - open.length);
      out.push(this._section('trips', 'mdi:map-marker-path', this._t('recent_trips'), count, rows, 'no_trips'));
    }
    if (c.refuels !== false) {
      const t = vcTracks(kind);
      const events = (list, key, unit) =>
        (Array.isArray(list) ? list : []).slice(0, VC_ROWS).map((e) => {
          const from = e.source === 'manual' || e.source === 'charger' ? this._t(e.source) : '';
          const sub = [vcFinite(e.odometer) ? `${f.num(e.odometer, 0)} ${u.dist}` : '', from]
            .filter(Boolean)
            .join(' · ');
          return this._row(f.date(e.time), sub || VC_DASH, vcFinite(e[key]) ? `${f.num(e[key], 1)} ${unit}` : VC_DASH, f.money(e.cost), e.source === 'manual');
        });
      if (t.fuel) out.push(this._section('refuels', 'mdi:gas-station', this._t('refuels'), vcFinite(a.refuel_count) ? a.refuel_count : a.refuels?.length || 0, events(a.refuels, 'liters', u.vol), 'no_refuels'));
      if (t.energy) out.push(this._section('charges', 'mdi:ev-station', this._t('charges'), vcFinite(a.charge_count) ? a.charge_count : a.charges?.length || 0, events(a.charges, 'energy', 'kWh'), 'no_charges'));
    }
    if (c.lease !== false && a.lease && typeof a.lease === 'object') out.push(this._leaseSection(a.lease, f, u));
    return out.length ? `<div class="sections">${out.join('')}</div>` : '';
  }

  // The lease allowance: a gauge (driven against the allowance, a mark at the pro rata), or the curve (allowance,
  // driven, projection) once switched; then what is left, the pace to stay within and the cost of the overage.
  _leaseSection(l, f, u) {
    const n = (v) => (vcFinite(v) ? f.num(v, 0) : VC_DASH);
    const allowance = Number(l.allowance) || 0;
    const driven = vcFinite(l.driven) ? Number(l.driven) : null;
    const balance = vcFinite(l.balance) ? Number(l.balance) : null;
    const over = vcFinite(l.overage) && Number(l.overage) > 0;
    // Green within the pro rata, amber ahead of it (or heading over), red past the allowance.
    const tone = driven != null && driven > allowance ? 'bad' : (balance != null && balance > 0) || over ? 'warn' : 'ok';
    const pill = l.ended
      ? this._t('lease_ended')
      : balance == null
        ? ''
        : balance > 0
          ? this._t('lease_ahead', { v: n(balance), u: u.dist })
          : this._t('lease_under', { v: n(-balance), u: u.dist });
    const curve = !!this._leaseCurve;
    const ratio = (v) => (allowance > 0 && vcFinite(v) ? Math.min(Math.max(Number(v) / allowance, 0), 1) : 0);
    // Half circle from the left (0) to the right (allowance): r 50 around (60, 60).
    const at = (r) => {
      const a = Math.PI * (1 - r);
      return [60 + 50 * Math.cos(a), 60 - 50 * Math.sin(a)];
    };
    const [ex, ey] = at(ratio(driven));
    const fill = ratio(driven) > 0 ? `<path class="lfill" d="M10 60 A50 50 0 0 1 ${ex.toFixed(2)} ${ey.toFixed(2)}"></path>` : '';
    const [m1x, m1y] = at(ratio(l.prorata));
    const [m2x, m2y] = [60 + ((m1x - 60) * 62) / 50, 60 + ((m1y - 60) * 62) / 50];
    const [m0x, m0y] = [60 + ((m1x - 60) * 38) / 50, 60 + ((m1y - 60) * 38) / 50];
    const gauge = `
            <svg class="lgauge" viewBox="0 0 120 70" role="img" aria-label="${vcEsc(`${n(driven)} / ${n(allowance)} ${u.dist}`)}">
              <path class="ltrack" d="M10 60 A50 50 0 0 1 110 60"></path>${fill}
              <line class="lmark" x1="${m0x.toFixed(2)}" y1="${m0y.toFixed(2)}" x2="${m2x.toFixed(2)}" y2="${m2y.toFixed(2)}"></line>
              <text class="lval" x="60" y="52">${vcEsc(n(driven))}</text>
              <text class="lunit" x="60" y="64">${vcEsc(`/ ${n(allowance)} ${u.dist}`)}</text>
            </svg>`;
    // The curve: elapsed time on x, distance on y (up to the allowance or the projection, whichever is higher).
    const top = Math.max(allowance, Number(l.projected) || 0, driven || 0) || 1;
    // Time elapsed in the contract, from its dates (the month number only without them): the end of the line is today.
    const t0 = Date.parse(l.start);
    const t1 = Date.parse(l.end);
    const elapsed =
      t1 > t0
        ? Math.min(Math.max((Date.now() - t0) / (t1 - t0), 0), 1)
        : l.months
          ? Math.min(Math.max(((Number(l.month) || 0) - 0.5) / Number(l.months), 0), 1)
          : 0;
    const X = (r) => (8 + r * 104).toFixed(2);
    const Y = (v) => (62 - (Math.max(Number(v) || 0, 0) / top) * 54).toFixed(2);
    const chart = `
            <svg class="lcurve" viewBox="0 0 120 70" role="img" aria-label="${vcEsc(this._t('lease'))}">
              <line class="laxis" x1="8" y1="62" x2="112" y2="62"></line>
              <line class="lplan" x1="${X(0)}" y1="${Y(0)}" x2="${X(1)}" y2="${Y(allowance)}"></line>
              ${driven != null ? `<line class="lreal" x1="${X(0)}" y1="${Y(0)}" x2="${X(elapsed)}" y2="${Y(driven)}"></line>` : ''}
              ${driven != null && vcFinite(l.projected) && !l.ended ? `<line class="lproj" x1="${X(elapsed)}" y1="${Y(driven)}" x2="${X(1)}" y2="${Y(l.projected)}"></line>` : ''}
              ${driven != null ? `<circle class="lnow" cx="${X(elapsed)}" cy="${Y(driven)}" r="2.4"></circle>` : ''}
            </svg>
            <div class="llegend"><span class="k-real">${vcEsc(this._t('lease_driven'))}</span><span class="k-plan">${vcEsc(this._t('lease_plan'))}</span><span class="k-proj">${vcEsc(this._t('lease_proj'))}</span></div>`;
    const cost = vcFinite(l.overage_cost)
      ? { v: f.money(l.overage_cost, 0), k: this._t('lease_cost') }
      : { v: `${n(l.overage)}`, k: this._t('lease_over_km', { u: u.dist }) };
    // Past the allowance: the distance over it (in the tone's red) instead of a negative distance left, and no
    // distance a month to stay within, which would be negative too.
    const exceeded = vcFinite(l.remaining) && Number(l.remaining) < 0;
    const tiles = [
      exceeded
        ? { v: n(-Number(l.remaining)), k: this._t('lease_over', { u: u.dist }), warn: true }
        : { v: n(l.remaining), k: this._t('lease_left', { u: u.dist }) },
      exceeded ? null : { v: n(l.per_month_left), k: this._t('lease_per_month', { u: u.dist }) },
      { ...cost, warn: over },
    ]
      .filter(Boolean)
      .map((t) => `<div class="ltile${t.warn ? ' warn' : ''}"><span class="lv">${vcEsc(t.v)}</span><span class="lk">${vcEsc(t.k)}</span></div>`)
      .join('');
    const foot = [
      vcFinite(l.projected) && !l.ended ? this._t('lease_projection', { v: n(l.projected), u: u.dist, p: n(l.pace) }) : '',
      !curve && vcFinite(l.prorata) ? this._t('lease_mark', { v: n(l.prorata), u: u.dist }) : '',
    ]
      .filter(Boolean)
      .join(' · ');
    const body = `
            <div class="lease lt-${tone}${curve ? ' curve' : ''}">
              <div class="lhead"><span class="lmonth">${vcEsc(this._t('lease_month', { n: l.month ?? 0, m: l.months ?? 0 }))}</span>${pill ? `<span class="lpill">${vcEsc(pill)}</span>` : ''}</div>
              <button class="lswap" type="button" aria-pressed="${curve}">${gauge}${chart}<span class="lhint">${vcEsc(this._t(curve ? 'lease_gauge' : 'lease_curve'))}</span></button>
              <div class="ltiles${exceeded ? ' two' : ''}">${tiles}</div>
              ${foot ? `<div class="lfoot">${vcEsc(foot)}</div>` : ''}
            </div>`;
    return this._section('lease', 'mdi:car-key', this._t('lease'), `${l.month ?? 0}/${l.months ?? 0}`, [body], 'lease');
  }

  // `value`: a text, or several (one a line).
  _row(main, sub, value, cost, manual = false) {
    const values = (Array.isArray(value) ? value : [value]).map((v) => `<span class="v">${vcEsc(v)}</span>`).join('');
    return `
              <div class="row${manual ? ' manual' : ''}">
                <span class="txt"><span class="name">${vcEsc(main)}</span><span class="sub">${vcEsc(sub)}</span></span>
                <span class="val">${values}<span class="sub">${vcEsc(cost)}</span></span>
              </div>`;
  }

  // A collapsible section: chevron right when folded, down when open.
  _section(key, icon, label, count, rows, emptyKey) {
    const open = this._open.has(key);
    // Only the last rows are listed: "5/6" when there are more.
    const shown = count > rows.length && rows.length ? `${rows.length}/${count}` : String(count);
    return `
          <section class="section${open ? ' open' : ''}" data-section="${key}">
            <button class="fold" data-key="${key}" aria-expanded="${open}">
              <ha-icon class="chev" icon="mdi:chevron-right"></ha-icon>
              <ha-icon class="sic" icon="${icon}"></ha-icon>
              <span class="slabel">${vcEsc(label)}</span>
              <span class="count">${shown}</span>
            </button>
            <div class="body"><div class="inner">${rows.length ? rows.join('') : `<div class="none">${vcEsc(this._t(emptyKey))}</div>`}</div></div>
          </section>`;
  }

  _toggle(key) {
    if (this._open.has(key)) this._open.delete(key);
    else this._open.add(key);
    this._applyFold();
  }

  // A click anywhere outside an open section folds it back.
  _foldOutside(ev, also) {
    if (!this._open.size) return;
    const inside = new Set([...vcSections(ev), ...(also || [])]);
    let changed = false;
    for (const key of [...this._open]) {
      if (!inside.has(key)) {
        this._open.delete(key);
        changed = true;
      }
    }
    if (changed) this._applyFold();
  }

  // Sections fold in place (the transition plays); the signature keeps the state for the next render.
  _applyFold() {
    for (const el of this.shadowRoot?.querySelectorAll?.('.section') || []) {
      const open = this._open.has(el.dataset.section);
      el.classList.toggle('open', open);
      el.querySelector('.fold')?.setAttribute('aria-expanded', String(open));
    }
    this._sig = null;
  }

  // ── Log a refuel / a charge ──
  _openPopup() {
    const kind = this._attrs?.kind;
    if (!this._attrs?.entry_id) return;
    this._popup = { mode: kind === 'electric' ? 'charge' : 'refuel', values: {}, error: '', busy: false };
    // The focus goes back to the add button once the popup closes.
    this._refocus = true;
    document.addEventListener('keydown', this._onKey);
    this._render(true);
    // Opened from the keyboard with the card scrolled out of view: the popup is brought into view (as little as
    // needed). Only here: the focus given back after a re-render (`_bind`) never scrolls the dashboard.
    this.shadowRoot?.querySelector?.('.sheet')?.scrollIntoView?.({ block: 'nearest' });
  }

  _closePopup() {
    if (!this._popup) return;
    this._popup = null;
    document.removeEventListener('keydown', this._onKey);
    this._render(true);
    if (this._refocus) this.shadowRoot?.querySelector?.('.add')?.focus?.({ preventScroll: true });
    this._refocus = false;
  }

  // A modal popup: Tab and Shift+Tab go round its fields and buttons, never out to the card or the dashboard.
  _trapTab(ev) {
    const root = this.shadowRoot;
    const items = [...(root?.querySelector?.('.sheet')?.querySelectorAll?.('button:not([disabled]), input') || [])];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const inside = items.includes(root.activeElement);
    if (ev.shiftKey && (!inside || root.activeElement === first)) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && (!inside || root.activeElement === last)) {
      ev.preventDefault();
      first.focus();
    }
  }

  _setMode(mode) {
    if (!this._popup || this._popup.mode === mode) return;
    this._popup.mode = mode;
    this._popup.values.amount = '';
    this._popup.error = '';
    this._render(true);
  }

  _input(name, value) {
    if (!this._popup) return;
    this._popup.values[name] = value;
    const save = this.shadowRoot?.querySelector?.('[data-act="save"]');
    if (save) save.disabled = !this._payload();
  }

  // The service and its data, or null while the amount is missing or invalid.
  _payload() {
    const p = this._popup;
    const amount = vcParse(p?.values.amount);
    if (!p || amount == null || amount <= 0) return null;
    const charge = p.mode === 'charge';
    const u = vcUnits(this._attrs);
    // The service takes litres, and an odometer in the unit of the odometer sensor (typed here in that unit).
    const data = { config_entry_id: this._attrs.entry_id, [charge ? 'energy' : 'liters']: charge ? amount : u.toLiters(amount) };
    const cost = vcParse(p.values.cost);
    const odometer = vcParse(p.values.odometer);
    if (cost != null && cost >= 0) data.cost = cost;
    if (odometer != null && odometer >= 0) data.odometer = odometer;
    return { service: charge ? 'add_charge' : 'add_refuel', data };
  }

  async _save() {
    const p = this._popup;
    const call = this._payload();
    if (!p || !call || p.busy) return;
    p.busy = true;
    try {
      await this._hass.callService('vehicle_consumption', call.service, call.data);
      if (this._popup === p) this._closePopup();
    } catch (err) {
      p.busy = false;
      p.error = this._t('save_error', { e: err?.message || String(err) });
      if (this._popup === p) this._render(true);
    }
  }

  _popupHtml(a, kind, f) {
    const p = this._popup;
    const charge = p.mode === 'charge';
    const title = this._t(charge ? 'add_charge' : 'add_refuel');
    const u = vcUnits(a);
    const field = (name, label, unit, placeholder = '', optional = false) => `
            <label class="field">
              <span class="flabel">${vcEsc(label)}${optional ? ` <i>${vcEsc(this._t('optional'))}</i>` : ''}</span>
              <span class="fbox"><input name="${name}" inputmode="decimal" autocomplete="off" value="${vcEsc(p.values[name] ?? '')}" placeholder="${vcEsc(placeholder)}"><em>${vcEsc(unit)}</em></span>
            </label>`;
    const tab = (mode, icon) =>
      `<button class="tab${p.mode === mode ? ' on' : ''}" data-mode="${mode}" aria-pressed="${p.mode === mode}"><ha-icon icon="${icon}"></ha-icon>${vcEsc(this._t(`mode_${mode}`))}</button>`;
    return `
        <div class="veil" data-act="cancel"></div>
        <div class="sheet" role="dialog" aria-modal="true" aria-label="${vcEsc(title)}">
          <div class="shead">
            <span class="ic"><ha-icon icon="${charge ? 'mdi:ev-station' : 'mdi:gas-station'}"></ha-icon></span>
            <span class="stitle">${vcEsc(title)}</span>
            <button class="icon-btn" data-act="cancel" title="${vcEsc(this._t('cancel'))}" aria-label="${vcEsc(this._t('cancel'))}"><ha-icon icon="mdi:close"></ha-icon></button>
          </div>
          ${kind === 'plugin_hybrid' ? `<div class="tabs" role="group">${tab('refuel', 'mdi:gas-station')}${tab('charge', 'mdi:ev-station')}</div>` : ''}
          <div class="fields">
            ${field('amount', this._t(charge ? 'energy' : 'liters'), charge ? 'kWh' : u.vol)}
            ${field('cost', this._t('total_cost'), f.symbol() || a.currency || '', '', true)}
            ${field('odometer', this._t('odometer'), u.odometer, vcFinite(a.odometer) ? f.num(u.toSource(Number(a.odometer)), 0) : '', true)}
          </div>
          ${p.error ? `<div class="err">${vcEsc(p.error)}</div>` : ''}
          <div class="actions">
            <button class="btn" data-act="cancel">${vcEsc(this._t('cancel'))}</button>
            <button class="btn accent" data-act="save"${this._payload() ? '' : ' disabled'}>${vcEsc(this._t('save'))}</button>
          </div>
        </div>`;
  }

  static get styles() {
    return `
      /* min-width: 0 lets a 1fr grid track shrink the card below its intrinsic width (no overflow). */
      :host {
        display: block;
        min-width: 0;
        --vc-ok: var(--primary-color, #03a9f4);
        --vc-drive: var(--success-color, #43a047);
        --vc-warn: var(--warning-color, #ffa600);
        --vc-na: var(--disabled-color, #9e9e9e);
        --vc-fuel: var(--vc-fuel-color, #f59e0b);
        --vc-battery: var(--vc-battery-color, #22c55e);
      }
      /* The inline-size container (ha-card) has no content width: in a parent sized by its content (inline-block, an
         "auto" grid column) it would fall to its padding. This empty row gives the card a 300px max-content width but a
         0 min-content one, so a 1fr grid track still shrinks it, even through a wrapper (a div, hui-card) that keeps
         min-width: auto. (An intrinsic-size containment would be a min-content width there: the card would overflow.) */
      :host::before { content: ""; display: grid; grid-template-columns: minmax(0, 300px); height: 0; }
      :host([mini])::before { grid-template-columns: minmax(0, 240px); }
      ha-card { position: relative; padding: 12px; overflow: hidden; container-type: inline-size;
                --ci: color-mix(in srgb, var(--c) 40%, var(--primary-text-color)); }
      ha-card.lvl-ok    { --c: var(--vc-ok); }
      ha-card.lvl-drive { --c: var(--vc-drive); }
      ha-card.lvl-warn  { --c: var(--vc-warn); }
      ha-card.lvl-na    { --c: var(--vc-na); }
      ha-card.has-popup { min-height: 360px; }

      .head { display: flex; align-items: center; gap: 10px; }
      .badge { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center;
               background: color-mix(in srgb, var(--c) 16%, transparent); color: var(--c); }
      .badge ha-icon { --mdc-icon-size: 24px; }
      .title { flex: 1 1 0; min-width: 4ch; display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 500;
               color: var(--primary-text-color); white-space: nowrap; }
      .title:has(.drive) { min-width: calc(4ch + 18px); }
      .tname { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
      :host([hide-title]) .head .tname { display: none; }
      .pill { flex: 0 1 auto; min-width: 0; max-width: 50%; overflow: hidden; text-overflow: ellipsis; font-size: 11px; font-weight: 500; padding: 1px 8px; border-radius: 999px; white-space: nowrap;
              color: var(--ci); background: color-mix(in srgb, var(--c) 14%, transparent); font-variant-numeric: tabular-nums; }
      .pdot { display: none; width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
      .head > .titles { flex: 1 1 0; min-width: 0; }
      /* The status pill, in every header: on the title row right after the title only when the whole title and the pill's
         whole label fit there; otherwise on its own line under the subtitle, cut to one line; its dot alone, beside the
         title, when the banner has no room left above its ground strip, or on a card of 200 px or less. Decided by
         measurement (see _fitPill), so that every language and every width gets it right. */
      .titles .trow { display: flex; align-items: center; gap: 8px; min-width: 0; width: 100%; }
      .titles .trow > .title { flex: 0 1 auto; min-width: 0; }
      .titles .trow > .pill { flex: none; max-width: none; margin: 0; align-self: center; }
      .titles.below { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; }
      .titles.below > * { max-width: 100%; }
      .titles.below .trow { display: contents; }
      .titles.below .trow > .title { max-width: 100%; }
      .titles.below .trow > .pill { order: 9; max-width: 100%; margin-top: 2px; align-self: flex-start; }
      /* In the banner, a pill on its own line may run over the picture, up to the banner's edge. */
      .banner .titles.below .trow > .pill { max-width: none; }
      .titles.below :is(.hsub) { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .titles.dotonly .trow > .pill { padding: 4px; } .titles.dotonly .trow > .pill .ptxt { display: none; }
      .titles.dotonly .trow > .pill .pdot { display: block; }
      @container (max-width: 200px) { .titles .trow > .pill { padding: 4px; } .titles .trow > .pill .ptxt { display: none; } .titles .trow > .pill .pdot { display: block; } }
      .icon-btn { all: unset; cursor: pointer; flex: none; width: 26px; height: 26px; border-radius: 50%;
                  display: grid; place-items: center; color: var(--secondary-text-color); }
      .icon-btn:hover { background: color-mix(in srgb, var(--secondary-text-color) 14%, transparent); color: var(--primary-text-color); }
      .icon-btn:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .icon-btn ha-icon { --mdc-icon-size: 18px; }
      /* The mini card's detail button, at the top right of the header. */
      .zoom { all: unset; flex: none; cursor: pointer; width: 24px; height: 24px; margin: -4px -4px 0 0; border-radius: 50%; align-self: flex-start;
              display: grid; place-items: center; color: var(--secondary-text-color); }
      .zoom:hover { background: color-mix(in srgb, var(--secondary-text-color) 14%, transparent); color: var(--primary-text-color); }
      .zoom:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 1px; }
      .zoom ha-icon { --mdc-icon-size: 16px; }
      .empty { margin-top: 10px; font-size: 13px; color: var(--secondary-text-color); }

      /* Driving: a pulsing dot next to the name */
      .drive { position: relative; flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--vc-drive); }
      .drive::after { content: ''; position: absolute; inset: 0; border-radius: 50%; background: var(--vc-drive);
                      animation: vc-pulse 1.6s ease-out infinite; }

      .gauges { display: grid; gap: 8px; margin-top: 12px; }
      .gauge { --t: var(--vc-fuel); display: grid; grid-template-columns: 28px 1fr auto; grid-template-rows: auto auto;
               column-gap: 10px; row-gap: 5px; align-items: center; }
      .gauge.g-battery { --t: var(--vc-battery); }
      .gauge.low { --t: var(--vc-warn); }
      .ic { flex: none; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
            color: var(--t, var(--c)); background: color-mix(in srgb, var(--t, var(--c)) 18%, transparent); }
      .gauge .ic { grid-row: span 2; }
      .ic ha-icon { --mdc-icon-size: 16px; }
      .glabel { font-size: 13px; font-weight: 500; color: var(--primary-text-color); line-height: 1.2; }
      .gval { font-size: 12px; font-weight: 500; color: var(--primary-text-color); font-variant-numeric: tabular-nums; line-height: 1.2; }
      .gauge.low .gval { color: color-mix(in srgb, var(--t) 40%, var(--primary-text-color)); }
      .track { grid-column: 2 / 4; height: 6px; border-radius: 3px; overflow: hidden;
               background: color-mix(in srgb, var(--secondary-text-color) 18%, transparent); }
      .fill { display: block; height: 100%; border-radius: 3px; transform-origin: left center;
              background: linear-gradient(90deg, color-mix(in srgb, var(--t) 70%, transparent), var(--t)); }
      .anim .fill { animation: vc-fill 1.1s cubic-bezier(.2,.8,.2,1) both; animation-delay: var(--vc-t, 0ms); }

      .kpis { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin-top: 12px; }
      @container (min-width: 560px) { .kpis { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
      .kpi { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 8px 10px; border-radius: 12px;
             background: var(--secondary-background-color, rgba(127,127,127,.08)); }
      .kl { display: flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 500; color: var(--secondary-text-color);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .kl ha-icon { --mdc-icon-size: 14px; flex: none; }
      .kv { font-size: 17px; font-weight: 600; line-height: 1.25; color: var(--primary-text-color);
            font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .kv small { margin-left: 3px; font-size: 11px; font-weight: 500; color: var(--secondary-text-color); }
      .ks { font-size: 11px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            font-variant-numeric: tabular-nums; }
      /* The average is the header pill's: under the odometer only when the pill keeps just its dot. */
      .ks.pill-echo { display: none; }
      :is(.head, .banner):has(.titles.dotonly) ~ .kpis .ks.pill-echo { display: block; }
      @container (max-width: 200px) { :is(.head, .banner) ~ .kpis .ks.pill-echo { display: block; } }
      /* Narrow card (6 columns of a section): the unit under the value, long labels on two lines. */
      @container (max-width: 250px) {
        .kv small { display: block; margin-left: 0; white-space: normal; }
        .kl, .ks { white-space: normal; overflow-wrap: anywhere; }
        .kl { align-items: flex-start; }
        .chead { flex-wrap: wrap; row-gap: 0; }
      }
      /* Two tiles of about 60 px of text: the labels ("Odometer", "Cost per km") keep their words without their icon. */
      @container (max-width: 200px) {
        .kl ha-icon { display: none !important; }
      }

      .chart { margin-top: 12px; padding: 10px 10px 4px; border-radius: 12px;
               background: var(--secondary-background-color, rgba(127,127,127,.08)); }
      .chead { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
      .ctitle { font-size: 12px; font-weight: 500; color: var(--primary-text-color); }
      .ctitle small { margin-left: 6px; font-weight: 400; color: var(--secondary-text-color); }
      .cspan { font-size: 11px; color: var(--secondary-text-color); }
      .chart svg { display: block; width: 100%; height: auto; overflow: visible; }
      .chart .base { stroke: var(--divider-color, rgba(127,127,127,.25)); stroke-width: 1; }
      .chart .bar { fill: color-mix(in srgb, var(--secondary-text-color) 32%, transparent); transform-box: fill-box; transform-origin: 50% 100%; }
      .chart .bar.now { fill: var(--primary-color, #03a9f4); }
      .chart .bar.stub { fill: color-mix(in srgb, var(--secondary-text-color) 14%, transparent); }
      .chart .col:hover .bar:not(.stub):not(.now) { fill: color-mix(in srgb, var(--secondary-text-color) 48%, transparent); }
      .anim .chart .bar:not(.stub) { animation: vc-grow .8s cubic-bezier(.2,.8,.2,1) both;
                                     animation-delay: calc(var(--vc-t, 0ms) + 200ms + var(--i, 0) * 70ms); }
      .anim .chart .bv { animation: vc-fade .4s ease-out both; animation-delay: calc(var(--vc-t, 0ms) + 800ms + var(--i, 0) * 70ms); }
      .chart text { font-size: 10px; text-anchor: middle; fill: var(--secondary-text-color); font-variant-numeric: tabular-nums; }
      .chart .bv { font-size: 9.5px; }
      .chart text.now { fill: color-mix(in srgb, var(--primary-color) 40%, var(--primary-text-color)); font-weight: 600; }

      .sections { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
      .section { border-radius: 10px; background: var(--secondary-background-color, rgba(127,127,127,.08)); }
      .fold { all: unset; box-sizing: border-box; cursor: pointer; width: 100%; display: flex; align-items: center; gap: 8px;
              padding: 8px 10px 8px 6px; border-radius: 10px; font-size: 13px; font-weight: 500; color: var(--primary-text-color); }
      .fold:hover { background: color-mix(in srgb, var(--secondary-text-color) 8%, transparent); }
      .fold:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .chev { --mdc-icon-size: 18px; color: var(--secondary-text-color); transition: transform .2s ease; }
      .section.open .chev { transform: rotate(90deg); color: var(--primary-color); }
      .sic { --mdc-icon-size: 16px; color: var(--secondary-text-color); }
      .slabel { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .count { font-size: 11px; font-weight: 500; padding: 0 7px; border-radius: 999px; color: var(--secondary-text-color);
               background: color-mix(in srgb, var(--secondary-text-color) 14%, transparent); }
      .body { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .25s ease; }
      .section.open .body { grid-template-rows: 1fr; }
      .inner { overflow: hidden; min-height: 0; }
      .section.open .inner { padding: 0 10px 6px; }
      .row { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-top: 1px solid var(--divider-color, rgba(127,127,127,.15)); }
      .txt, .val { display: flex; flex-direction: column; min-width: 0; }
      .txt { flex: 1; }
      .val { flex: 0 1 auto; min-width: 0; max-width: 60%; align-items: flex-end; }
      .name, .v { font-size: 13px; font-weight: 500; line-height: 1.25; color: var(--primary-text-color); white-space: nowrap;
                  overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
      .sub { font-size: 11px; line-height: 1.25; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden;
             text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
      .row.manual .txt .sub { color: color-mix(in srgb, var(--primary-color) 40%, var(--primary-text-color)); }
      .lease { --lt: #43a047; display: flex; flex-direction: column; gap: 8px; padding: 8px 0 4px; border-top: 1px solid var(--divider-color, rgba(127,127,127,.15)); }
      .lease.lt-warn { --lt: #f59e0b; } .lease.lt-bad { --lt: var(--error-color, #db4437); }
      .lhead { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .lmonth { font-size: 12px; color: var(--secondary-text-color); }
      .lpill { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; white-space: nowrap;
               color: color-mix(in srgb, var(--lt) 70%, var(--primary-text-color)); background: color-mix(in srgb, var(--lt) 16%, transparent); }
      .lswap { all: unset; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; border-radius: 10px; padding: 4px 0; }
      .lswap:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .lswap svg { width: 100%; max-width: 240px; height: auto; display: block; }
      .lease .lcurve, .lease .llegend, .lease.curve .lgauge { display: none; }
      .lease.curve .lcurve { display: block; } .lease.curve .llegend { display: flex; }
      .ltrack, .lfill { fill: none; stroke-width: 10; stroke-linecap: round; }
      .ltrack { stroke: color-mix(in srgb, var(--secondary-text-color) 18%, transparent); }
      .lfill { stroke: var(--lt); }
      .lmark { stroke: var(--primary-text-color); stroke-width: 1.6; stroke-linecap: round; }
      .lval { font-size: 15px; font-weight: 700; text-anchor: middle; fill: var(--primary-text-color); font-variant-numeric: tabular-nums; }
      .lunit { font-size: 6.5px; text-anchor: middle; fill: var(--secondary-text-color); }
      .laxis { stroke: var(--divider-color, rgba(127,127,127,.3)); stroke-width: .6; }
      .lplan { stroke: var(--secondary-text-color); stroke-width: 1; stroke-dasharray: 3 2.5; }
      .lreal { stroke: #43a047; stroke-width: 1.8; stroke-linecap: round; }
      .lproj { stroke: var(--lt); stroke-width: 1.6; stroke-dasharray: 1 2.5; stroke-linecap: round; }
      .lnow { fill: #43a047; }
      .llegend { gap: 12px; font-size: 11px; color: var(--secondary-text-color); }
      .llegend span::before { content: ''; display: inline-block; width: 12px; height: 2px; margin-right: 4px; vertical-align: middle; }
      .k-real::before { background: #43a047; } .k-plan::before { background: var(--secondary-text-color); } .k-proj::before { background: var(--lt); }
      .lhint { font-size: 11px; color: color-mix(in srgb, var(--primary-color) 40%, var(--primary-text-color)); }
      .ltiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
      .ltiles.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .ltile { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 6px 8px; border-radius: 8px;
               background: color-mix(in srgb, var(--secondary-text-color) 8%, transparent); }
      .ltile .lv { font-size: 14px; font-weight: 600; color: var(--primary-text-color); font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .ltile.warn .lv { color: color-mix(in srgb, var(--lt) 75%, var(--primary-text-color)); }
      .ltile .lk { font-size: 11px; line-height: 1.25; color: var(--secondary-text-color); }
      .lfoot { font-size: 11px; color: var(--secondary-text-color); }
      .none { padding: 8px 0 4px; font-size: 12px; color: var(--secondary-text-color); border-top: 1px solid var(--divider-color, rgba(127,127,127,.15)); }

      /* The popup: anchored at the top of the card, over a smoked veil */
      .veil { position: absolute; inset: 0; z-index: 2; cursor: pointer;
              background: color-mix(in srgb, var(--card-background-color, #fff) 55%, transparent);
              -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); animation: vc-fade .18s ease-out both; }
      .sheet { position: absolute; top: 8px; left: 8px; right: 8px; z-index: 3; box-sizing: border-box; padding: 12px;
               border-radius: 14px; border: 1px solid var(--divider-color, rgba(127,127,127,.2));
               background: color-mix(in srgb, var(--card-background-color, #fff) 92%, transparent);
               -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px);
               box-shadow: 0 10px 30px rgba(0,0,0,.18); animation: vc-drop .22s cubic-bezier(.2,.8,.2,1) both; }
      .shead { display: flex; align-items: center; gap: 10px; }
      .shead .ic { --t: var(--primary-color); }
      .stitle { flex: 1; min-width: 0; font-size: 15px; font-weight: 500; color: var(--primary-text-color); }
      .tabs { display: flex; gap: 4px; margin-top: 12px; padding: 3px; border-radius: 12px;
              background: var(--secondary-background-color, rgba(128,128,128,.1)); }
      .tab { all: unset; cursor: pointer; flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
             padding: 6px 12px; border-radius: 9px; font-size: 13px; font-weight: 500; color: var(--secondary-text-color); }
      .tab ha-icon { --mdc-icon-size: 16px; }
      .tab.on { background: color-mix(in srgb, var(--primary-color) 15%, transparent); color: color-mix(in srgb, var(--primary-color) 40%, var(--primary-text-color)); }
      .tab:focus-visible, .btn:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .fields { display: grid; gap: 10px; margin-top: 12px; }
      .field { display: flex; flex-direction: column; gap: 4px; }
      .flabel { font-size: 12px; font-weight: 500; color: var(--secondary-text-color); }
      .flabel i { font-style: normal; font-weight: 400; opacity: .75; }
      .fbox { display: flex; align-items: center; gap: 6px; padding: 0 12px; border-radius: 10px;
              border: 1px solid var(--divider-color, rgba(127,127,127,.3)); background: transparent; }
      .fbox:focus-within { border-color: var(--primary-color); box-shadow: 0 0 0 1px var(--primary-color); }
      .fbox input { all: unset; flex: 1; min-width: 0; padding: 9px 0; font-size: 14px; color: var(--primary-text-color);
                    font-variant-numeric: tabular-nums; }
      .fbox input::placeholder { color: var(--secondary-text-color); opacity: .6; }
      .fbox em { font-style: normal; font-size: 12px; color: var(--secondary-text-color); }
      .err { margin-top: 10px; font-size: 12px; color: var(--error-color, #db4437); }
      .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
      .btn { all: unset; cursor: pointer; padding: 7px 16px; border-radius: 999px; font-size: 13px; font-weight: 500;
             color: var(--primary-text-color); border: 1px solid var(--divider-color, rgba(127,127,127,.35)); }
      .btn:hover { background: color-mix(in srgb, var(--secondary-text-color) 10%, transparent); }
      .btn.accent { color: color-mix(in srgb, var(--primary-color) 40%, var(--primary-text-color)); border-color: color-mix(in srgb, var(--primary-color) 60%, transparent); }
      .btn.accent:hover { background: color-mix(in srgb, var(--primary-color) 10%, transparent); }
      .btn[disabled] { cursor: default; opacity: .45; background: none; }

      @keyframes vc-pulse { 0% { transform: scale(1); opacity: .7 } 100% { transform: scale(3); opacity: 0 } }
      @keyframes vc-fill { from { transform: scaleX(0) } to { transform: scaleX(1) } }
      @keyframes vc-grow { from { transform: scaleY(0) } to { transform: scaleY(1) } }
      @keyframes vc-fade { from { opacity: 0 } to { opacity: 1 } }
      @keyframes vc-drop { from { opacity: 0; transform: translateY(-10px) } to { opacity: 1; transform: none } }
      @media (prefers-reduced-motion: reduce) {
        .drive::after, .anim .fill, .anim .chart .bar, .anim .chart .bv, .veil, .sheet { animation: none !important; }
        .chev, .body { transition: none; }
      }
    ${VC_BANNER_STYLE}`;
  }
}

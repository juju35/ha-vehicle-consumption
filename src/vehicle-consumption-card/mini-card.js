/**
 * Compact card: header (badge, name, average), the gauges, the last trip and the average. Its detail button (top
 * right, `zoom: false` removes it) switches it to the full card and back; a click outside the card brings the compact
 * view back.
 */
import { vcEsc, vcInDialog } from "./core.js";
import { VehicleConsumptionCard } from "./card.js";

export class VehicleConsumptionMiniCard extends VehicleConsumptionCard {
  static getConfigElement() {
    return document.createElement('vehicle-consumption-mini-card-editor');
  }

  constructor() {
    super();
    this._zoomed = false;
    const outside = (ev) => !ev.composedPath().includes(this) && !vcInDialog(ev);
    this._onOutside = (ev) => {
      if (this._zoomed && outside(ev)) this._setZoom(false);
    };
    // A tap elsewhere on iOS sends no click: the press and the release outside the card count (see the full card);
    // keyboard clicks (no click count) still come as click events.
    let downOutside = false;
    this._onOutsideDown = (ev) => {
      downOutside = outside(ev);
    };
    this._onOutsideUp = (ev) => {
      if (downOutside) this._onOutside(ev);
      downOutside = false;
    };
    this._onOutsideClick = (ev) => {
      if (!ev?.detail) this._onOutside(ev);
    };
  }

  setConfig(config) {
    // The host attribute behind the mini card's styles; never set in the constructor.
    this.setAttribute?.('mini', '');
    super.setConfig(config);
  }

  connectedCallback() {
    document.addEventListener('pointerdown', this._onOutsideDown, true);
    document.addEventListener('pointerup', this._onOutsideUp, true);
    document.addEventListener('click', this._onOutsideClick, true);
    super.connectedCallback();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('pointerdown', this._onOutsideDown, true);
    document.removeEventListener('pointerup', this._onOutsideUp, true);
    document.removeEventListener('click', this._onOutsideClick, true);
    // Back to the compact view once off the screen, as on the other cards.
    this._zoomed = false;
  }

  getCardSize() {
    return this._zoomed ? super.getCardSize() : 3;
  }

  getGridOptions() {
    return this._zoomed ? super.getGridOptions() : { columns: 6, min_columns: 6, rows: 'auto' };
  }

  _compact() {
    return !this._zoomed;
  }

  _zoomButton() {
    if (this._config?.zoom === false) return '';
    const label = vcEsc(this._t(this._zoomed ? 'zoom_out' : 'zoom_in'));
    return `<button class="zoom" title="${label}" aria-label="${label}" aria-expanded="${this._zoomed}"><ha-icon icon="mdi:${this._zoomed ? 'arrow-collapse' : 'arrow-expand'}"></ha-icon></button>`;
  }

  _zoomClick(ev) {
    ev?.stopPropagation?.();
    this._setZoom(!this._zoomed);
    // Keyboard use (Enter / Space: no click count) keeps the focus on the button, without scrolling the page.
    if (!ev?.detail) this.shadowRoot?.querySelector?.('.zoom')?.focus?.({ preventScroll: true });
  }

  _setZoom(zoomed) {
    this._zoomed = zoomed;
    // The popup is only on the full view: folding drops it.
    if (!zoomed && this._popup) {
      this._popup = null;
      this._refocus = false;
      document.removeEventListener('keydown', this._onKey);
    }
    this._render(true);
  }
}

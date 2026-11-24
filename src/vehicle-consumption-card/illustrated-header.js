// ── Illustrated header ───────────────────────────────────────────────────────
// A 200 × 80 picture at the right of a 90 px banner, over a 10 px road strip: the fuel pump (fuel, plug-in hybrid)
// or the charging station (electric), whose screen shows the tank / battery, beside the tracking: the last months'
// consumption (bars, the current month coloured, the average dashed) and the last refuel or charge worked out
// (amount and cost). The left of the banner is open sky for the title. No ids in the picture: several cards on
// one page cannot clash (`uid` still tells the instances apart, for the tests and the styles).
import { vcEsc, vcFinite } from "./core.js";

export const VC_GRADE = { petrol: 'E10', diesel: 'B7', lpg: 'LPG', e85: 'E85' };

// Night picture: forced by illustration_theme, else Home Assistant's dark theme alone (a light theme keeps the day
// picture after sunset).
export const vcIsNight = (hass, config) => {
  const theme = config?.illustration_theme;
  if (theme === 'night') return true;
  if (theme === 'day') return false;
  return !!hass?.themes?.darkMode;
};

// The scene: `s` = { ev, hybrid, bars: [number|null] (oldest first), avg, unit, calc, screen, grade, level }.
export function vcSceneSvg(s) {
  const vals = s.bars.filter((v) => v != null);
  // The range holds the average too, so its dashed line sits among the bars.
  const span = vcFinite(s.avg) ? [...vals, Number(s.avg)] : vals;
  const mx = vals.length ? Math.max(...span) : 1;
  const mn = vals.length ? Math.min(...span) * 0.85 : 0;
  const h = (v) => 6 + ((v - mn) / (mx - mn || 1)) * 22;
  const last = s.bars.length - 1;
  const bars = s.bars
    .map((v, i) => {
      const bh = v == null ? 3 : h(v);
      const cls = v == null ? 'vc-stub' : i === last ? 'vc-bar vc-now' : 'vc-bar';
      return `<rect class="${cls}" style="--i:${i}" x="${2 + i * 7}" y="${(30 - bh).toFixed(1)}" width="5" height="${bh.toFixed(1)}" rx="1"/>`;
    })
    .join('');
  const avg = vcFinite(s.avg) && vals.length ? `<path class="vc-avg" d="M1 ${(30 - h(Number(s.avg))).toFixed(1)} h50"/>` : '';
  const chart = `<g class="vc-hist" transform="translate(96 16)"><rect class="vc-box" x="-4" y="-4" width="58" height="42" rx="4"/>${bars}${avg}<text class="vc-unit" x="0" y="-.6">${vcEsc(s.unit)}</text></g>`;
  // The calculation: a pill centred under the chart, as wide as its text.
  const cw = Math.min(66, Math.max(40, String(s.calc || '').length * 3.5 + 8));
  const calc = s.calc
    ? `<g class="vc-calc" transform="translate(117 62)"><rect class="vc-cbox" x="${(-cw / 2).toFixed(1)}" y="-6" width="${cw.toFixed(1)}" height="14" rx="3"/><text class="vc-ctxt" y="3.2">${vcEsc(s.calc)}</text></g>`
    : '';
  const bolt = (x, y) => `<path class="vc-bolt" d="M${x + 1} ${y} l-4 6 h3 l-2 5 l6 -7 h-3 l2 -4z"/>`;
  const panel = s.ev
    ? bolt(0, -31)
    : `<text class="vc-grade" y="-24.6">${vcEsc(s.grade)}</text>`;
  const pump = `<g class="vc-pump" transform="translate(176 78)"><rect class="vc-body" x="-12" y="-52" width="24" height="52" rx="3"/><rect class="vc-screen" x="-9" y="-48" width="18" height="12" rx="1.5"/><text class="vc-cnt" y="-40">${vcEsc(s.screen)}</text><rect class="vc-panel" x="-8" y="-32" width="16" height="10" rx="1.5"/>${panel}<rect class="vc-foot" x="-14" y="-2" width="28" height="3" rx="1"/><path class="vc-hose" d="M12 -30 q10 0 10 10 v14"/><rect class="vc-nozzle" x="18" y="-8" width="8" height="5" rx="1"/>${s.hybrid ? '<g class="vc-plug" transform="translate(-12 -14)"><circle r="4.6"/><path d="M.3 -3.3l-2.4 3.6h1.8l-1.2 3 3.6 -4.2h-1.8l1.2 -2.4z"/></g>' : ''}</g>`;
  // Driving: a car goes by on the road, behind the calculation and the pump.
  const car =
    s.level === 'drive'
      ? `<g class="vc-car"><g transform="translate(60 80)"><path class="vc-carbody" d="M0 -5 Q1 -10 8 -11 L14 -15 H26 L33 -11 Q40 -10 40 -5 V-3.4 H0Z"/><path class="vc-carglass" d="M15 -14 H25 L30 -11 H11Z"/><circle class="vc-wheel" cx="9" cy="-3.4" r="3.4"/><circle class="vc-wheel" cx="31" cy="-3.4" r="3.4"/></g></g>`
      : '';
  const stars = '<g class="vc-stars"><circle cx="70" cy="8" r=".6"/><circle cx="84" cy="22" r=".5"/><circle cx="150" cy="5" r=".6"/><circle cx="196" cy="12" r=".5"/></g>';
  return `<svg class="vc-scene" viewBox="0 0 200 80" preserveAspectRatio="xMaxYMax slice" aria-hidden="true" focusable="false">${stars}<g transform="translate(200 80) scale(1.08) translate(-200 -80)">${chart}${car}${calc}${pump}</g></svg>`;
}

// The banner's styles: sky (day / night), title on its left, the scene at its right, the road strip under it all.
export const VC_BANNER_STYLE = `
      .banner { position: relative; height: 90px; margin: -12px -12px 0; overflow: hidden; --vc-g: 10px;
                --vc-scene-w: min(200px, 62%); --sky-text: #0d2a45; --sky-muted: #3b5b78;
                background: linear-gradient(90deg, #f1f8ff 0%, #e2f1fd 34%, #b9def8 70%, #9fd0f3 100%); }
      .banner.night { --sky-text: #fff; --sky-muted: rgba(255,255,255,.78);
                      background: linear-gradient(90deg, #1b2f52 0%, #15284a 36%, #0f1f3d 72%, #0a1830 100%); }
      .banner .head { position: absolute; z-index: 1; left: 0; top: 0; bottom: var(--vc-g); right: calc(var(--vc-scene-w) + var(--vc-sr, 0px));
                      padding: 8px 8px 8px 14px; box-sizing: border-box; min-width: 0; color: var(--sky-text); }
      .banner .badge { position: relative; background: rgba(255,255,255,.62); box-shadow: inset 0 0 0 1px rgba(13,42,69,.12); }
      .banner.night .badge { background: rgba(255,255,255,.12); box-shadow: inset 0 0 0 1px rgba(255,255,255,.14);
                             color: color-mix(in srgb, var(--c) 72%, #fff); }
      .htxt { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
      /* The pill in the level's colour on a frosted tint (where it goes: the rule in the card's styles, _fitPill). */
      .banner .title { color: var(--sky-text); }
      /* The title keeps about four characters even where the picture leaves almost no room (mini card, 2 buttons). */
      .banner .titles .trow > .title { min-width: 4ch; }
      .banner .pill { display: inline-flex; align-items: center; gap: 4px; max-width: 51%; line-height: 16px; box-sizing: border-box; border-radius: 12px;
                      background: color-mix(in srgb, var(--c) 18%, rgba(255,255,255,.78)); color: color-mix(in srgb, var(--c) 45%, #0d2a45); }
      .banner.night .pill { background: color-mix(in srgb, var(--c) 30%, rgba(8,18,38,.55)); color: color-mix(in srgb, var(--c) 35%, #ffffff); }
      .banner .pdot { display: block; width: 7px; height: 7px; flex: none; }
      .banner .ptxt { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
      .banner .titles.below { gap: 0; }
      .hsub { font-size: 13px; color: var(--sky-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
              font-variant-numeric: tabular-nums; }
      /* The header buttons (log a refuel, the mini card's expand / collapse) on one line at the banner's top right
         corner: 24 px frosted round buttons, 4 px apart, the scene moved left of them (--vc-sr). */
      .hbtns { position: absolute; z-index: 2; top: 5px; right: 5px; display: flex; gap: 4px; }
      .hbtns .icon-btn, .hbtns .zoom { margin: 0; width: 24px; height: 24px; color: #33506b; background: rgba(255,255,255,.55);
                                       box-shadow: inset 0 0 0 1px rgba(255,255,255,.7); backdrop-filter: blur(4px); }
      .hbtns .icon-btn ha-icon, .hbtns .zoom ha-icon { --mdc-icon-size: 16px; }
      .hbtns .icon-btn:hover, .hbtns .zoom:hover { background: rgba(255,255,255,.75); color: #33506b; }
      .banner.night .hbtns .icon-btn, .banner.night .hbtns .zoom { color: #fff; background: rgba(255,255,255,.12); box-shadow: inset 0 0 0 1px rgba(255,255,255,.2); }
      .banner.night .hbtns .icon-btn:hover, .banner.night .hbtns .zoom:hover { background: rgba(255,255,255,.22); color: #fff; }
      .vc-road { position: absolute; left: 0; right: 0; bottom: 0; height: var(--vc-g); background: #858c94; box-shadow: inset 0 1px 0 #6f767d; }
      .vc-road::after { content: ""; position: absolute; left: 0; right: 0; top: calc(50% - .8px); height: 1.6px;
                        background: repeating-linear-gradient(90deg, rgba(255,255,255,.85) 0 9px, transparent 9px 18px); }
      .night .vc-road { background: #2c323b; box-shadow: inset 0 1px 0 #3a414b; }
      .night .vc-road::after { background: repeating-linear-gradient(90deg, rgba(255,255,255,.4) 0 9px, transparent 9px 18px); }
      .vc-scene { position: absolute; right: var(--vc-sr, 0px); bottom: var(--vc-g); height: calc(100% - var(--vc-g)); width: var(--vc-scene-w); }
      .vc-scene text { font-family: Roboto, system-ui, sans-serif; }
      .vc-stars { fill: #fff; opacity: 0; } .night .vc-stars { opacity: .8; }
      .vc-box { fill: #fff; stroke: #dbe2ea; stroke-width: 1; } .night .vc-box { fill: #2a3446; stroke: #3a4456; }
      .vc-unit { font-size: 4.4px; fill: #5c6470; } .night .vc-unit { fill: #a0a6ae; }
      .vc-bar { fill: #c9d2de; transform-box: fill-box; transform-origin: 50% 100%; } .night .vc-bar { fill: #4a5568; }
      .vc-stub { fill: #e3e8ee; } .night .vc-stub { fill: #343e50; }
      .banner { --vc-k: #f58220; } .banner.k-ev { --vc-k: #43a047; } .banner.lvl-na { --vc-k: #9aa1a9; }
      .vc-bar.vc-now, .night .vc-bar.vc-now { fill: var(--vc-k); }
      .vc-avg { fill: none; stroke: var(--vc-k); stroke-width: .8; stroke-dasharray: 2 2; }
      .vc-cbox { fill: #fff; stroke: var(--vc-k); stroke-width: 1; } .night .vc-cbox { fill: #2a3446; }
      .vc-ctxt { font-size: 6.2px; font-weight: 700; text-anchor: middle; fill: color-mix(in srgb, var(--vc-k) 80%, #000); }
      .night .vc-ctxt { fill: color-mix(in srgb, var(--vc-k) 75%, #fff); }
      .vc-body { fill: var(--vc-k); }
      .vc-screen { fill: #101418; }
      .vc-cnt { font-size: 5.6px; font-weight: 700; font-family: ui-monospace, monospace; text-anchor: middle; fill: #ffd65a; }
      .lvl-warn .vc-cnt { fill: #ffb020; animation: vc-blink 1.2s steps(2) infinite; }
      .vc-panel { fill: #fff; opacity: .9; } .night .vc-panel { fill: #e6e9ee; }
      .vc-grade { font-size: 5px; font-weight: 700; text-anchor: middle; fill: var(--vc-k); }
      .vc-bolt { fill: var(--vc-k); }
      .k-ev .vc-panel + .vc-bolt { animation: vc-glow 2s ease-in-out infinite; }
      .vc-plug circle { fill: #43a047; stroke: #fff; stroke-width: .8; } .vc-plug path { fill: #fff; }
      .vc-foot { fill: #5f6b7a; }
      .vc-hose { fill: none; stroke: #2a3038; stroke-width: 2; } .night .vc-hose { stroke: #3a424e; }
      .vc-nozzle { fill: #2a3038; }
      .vc-carbody { fill: #1f4aa8; } .night .vc-carbody { fill: #2c5bc4; }
      .vc-carglass { fill: #cfe6f7; } .night .vc-carglass { fill: #3b4b5e; }
      .vc-wheel { fill: #22262b; }
      .vc-car { animation: vc-drive 7s linear infinite; }
      .vc-bar { animation: vc-bars 6s ease-out infinite; animation-delay: calc(var(--i, 0) * 100ms); }
      /* Narrow card (the mini card in a phone's section): only the pump or the charging station beside the title. */
      @container (max-width: 340px) {
        .banner { --vc-scene-w: 66px; }
        .vc-hist, .vc-calc { display: none; }
      }
      @keyframes vc-drive { from { transform: translateX(-110px); } to { transform: translateX(150px); } }
      @keyframes vc-bars { 0% { transform: scaleY(.1); } 30%, 100% { transform: scaleY(1); } }
      @keyframes vc-blink { 50% { opacity: .25; } }
      @keyframes vc-glow { 50% { opacity: .45; } }
      @media (prefers-reduced-motion: reduce) {
        .vc-car, .vc-bar, .vc-cnt, .vc-bolt { animation: none !important; }
      }
`;

// Patches `cur` in place to the markup `html`: kept nodes keep their size, their running animations and the focus,
// so a state update does not make the card jump (a stylesheet, a chart or a scene created again can leave the card
// without its height for a frame, and the sections grid reflows). Children are matched by `data-section`, else by
// position. A custom element with no markup inside (ha-icon) draws itself: it is kept as it is while its markup stays
// the same, and replaced by the new one when that changes.
export function vcPatchAttrs(cur, next) {
  for (const { name } of [...cur.attributes]) if (!next.hasAttribute(name)) cur.removeAttribute(name);
  for (const { name, value } of next.attributes) if (cur.getAttribute(name) !== value) cur.setAttribute(name, value);
  // A field typed in no longer follows its value attribute: it gets the value of the new markup.
  if (cur.localName === 'input' && cur.value !== (next.getAttribute('value') ?? '')) cur.value = next.getAttribute('value') ?? '';
}
export function vcKey(n) {
  return n?.nodeType === 1 ? n.getAttribute('data-section') : null;
}
export function vcLeaf(n) {
  return n.nodeType === 1 && n.localName.includes('-') && !n.childNodes.length;
}
export function vcSig(n) {
  return [...n.attributes].map((a) => `${a.name}=${a.value}`).join(' ');
}
export function vcMark(n) {
  if (n.nodeType !== 1) return;
  if (vcLeaf(n)) n._morphSig = vcSig(n);
  else for (const c of n.childNodes) vcMark(c);
}
export function vcPatchChildren(cur, next) {
  const old = [...cur.childNodes];
  const fresh = [...next.childNodes];
  const byKey = new Map();
  for (const o of old) {
    const k = vcKey(o);
    if (k !== null && !byKey.has(k)) byKey.set(k, o);
  }
  const used = new Set();
  fresh.forEach((n, i) => {
    const k = vcKey(n);
    let o = k !== null ? byKey.get(k) : old[i];
    if (!o || o.nodeType !== n.nodeType || o.nodeName !== n.nodeName || used.has(o) || (k === null && vcKey(o) !== null)) o = null;
    const ref = cur.childNodes[i] ?? null;
    if (o && vcLeaf(n) && o._morphSig !== vcSig(n)) o = null;
    if (!o) {
      vcMark(n);
      cur.insertBefore(n, ref);
      return;
    }
    used.add(o);
    if (o !== ref) cur.insertBefore(o, ref);
    if (n.nodeType === 1) {
      if (vcLeaf(n)) return;
      vcPatchAttrs(o, n);
      vcPatchChildren(o, n);
    } else if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue;
  });
  while (cur.childNodes.length > fresh.length) cur.removeChild(cur.lastChild);
}
export function vcMorph(cur, html) {
  // Not a DOM node (a stand-in in the unit tests): written as a whole.
  if (!cur.childNodes) {
    cur.innerHTML = html;
    return;
  }
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  vcPatchChildren(cur, tpl.content);
}

"""The card in Chromium: `python -m unittest discover -s scripts` (needs `pip install playwright` and its Chromium).

The popup opened from the keyboard while the card is scrolled out of view comes into view; a re-render with the
focus in the card (the popup's mode, a state update) never scrolls the dashboard.
"""

import importlib.util
import os
import unittest
from pathlib import Path

from playwright.sync_api import sync_playwright

spec = importlib.util.spec_from_file_location("screenshots", Path(__file__).with_name("screenshots.py"))
shots = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shots)

# The card first, then a long dashboard below it.
MOUNT = """([hass]) => {
    const spacer = document.createElement("div");
    spacer.style.height = "3000px";
    document.body.appendChild(spacer);
    const el = document.createElement("vehicle-consumption-card");
    el.setConfig({ type: "custom:vehicle-consumption-card" });
    el.hass = { ...hass, callService: async () => {} };
    document.getElementById("root").appendChild(el);
    window.card = el;
}"""
SHEET = """() => {
    const r = window.card.shadowRoot.querySelector(".sheet").getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, height: innerHeight };
}"""


# The illustrated header: the pill shows its whole label from 245 to 500 px, right after a readable title (at most
# about half of the title row) or on its own line under the subtitle; the header buttons (log a refuel, the mini
# card's expand / collapse) are 24 px, on one line at the banner's top right corner, the zoom 5 px from it.
PILL = """async ([hass, tag, zoom, width]) => {
    const frames = (n) => new Promise((r) => { const step = () => (n-- > 0 ? requestAnimationFrame(step) : r()); step(); });
    const root = document.getElementById("root");
    root.innerHTML = "";
    document.body.style.width = `${width}px`;
    const el = document.createElement(tag);
    el.setConfig({ type: `custom:${tag}` });
    el.hass = { ...hass, callService: async () => {} };
    root.appendChild(el);
    await frames(3);
    if (zoom) el.shadowRoot.querySelector(".zoom").dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, detail: 1 }));
    await frames(4);
    const r = el.shadowRoot;
    const out = [];
    const pill = r.querySelector(".banner .pill");
    if (!pill) return ["no pill"];
    const txt = pill.querySelector(".ptxt");
    if (txt.scrollWidth > txt.clientWidth + 0.5 || !txt.clientWidth) out.push("label cut");
    const nb = r.querySelector(".banner .tname").getBoundingClientRect();
    if (nb.width < 24) out.push(`title ${Math.round(nb.width)}px`);
    const pb = pill.getBoundingClientRect();
    const onRow = Math.abs(pb.top + pb.height / 2 - (nb.top + nb.height / 2)) < 3;
    const row = r.querySelector(".trow").getBoundingClientRect();
    if (onRow && pb.width > row.width * 0.51 + 0.5) out.push(`pill ${Math.round(pb.width)} of ${Math.round(row.width)}px`);
    const bb = r.querySelector(".banner").getBoundingClientRect();
    if (pb.right > bb.right - 4 || pb.bottom > bb.bottom - 10) out.push("pill out of the banner");
    const btns = [...r.querySelectorAll(".hbtns > *")].map((b) => b.getBoundingClientRect());
    for (const b of btns) if (Math.round(b.width) !== 24 || Math.round(b.height) !== 24 || Math.round(b.top - bb.top) !== 5) out.push(`button ${Math.round(b.width)}x${Math.round(b.height)} at ${Math.round(b.top - bb.top)}`);
    const z = r.querySelector(".hbtns .zoom")?.getBoundingClientRect();
    if (tag.includes("mini") && (!z || Math.round(bb.right - z.right) !== 5)) out.push("zoom not at the corner");
    return out;
}"""


class Popup(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH") or None)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def page(self, kind):
        page = self.browser.new_page(viewport={"width": 800, "height": 700})
        self.addCleanup(page.close)
        page.set_content(shots.page_html("light"))
        page.add_script_tag(content=shots.HA_ELEMENTS)
        page.add_script_tag(content=shots.CARD_JS)
        page.evaluate(MOUNT, [shots.mock_hass(kind)])
        page.wait_for_timeout(100)
        return page

    def test_opened_from_the_keyboard_out_of_view_it_comes_into_view(self):
        page = self.page("fuel")
        page.evaluate("() => window.card.shadowRoot.querySelector('.add').focus()")
        page.evaluate("() => window.scrollTo(0, 900)")  # the card is above the viewport
        self.assertLess(page.evaluate("() => window.card.getBoundingClientRect().bottom"), 0)
        page.keyboard.press("Enter")
        page.wait_for_timeout(100)
        sheet = page.evaluate(SHEET)
        self.assertGreaterEqual(sheet["top"], 0, sheet)
        self.assertLessEqual(sheet["bottom"], sheet["height"], sheet)
        focused = page.evaluate("() => window.card.shadowRoot.activeElement?.name")
        self.assertEqual(focused, "amount")

    def test_a_re_render_with_the_focus_in_the_popup_does_not_scroll(self):
        page = self.page("plugin_hybrid")
        page.evaluate("() => window.card._openPopup()")
        page.evaluate("() => window.scrollTo(0, 900)")
        page.evaluate("() => window.card._setMode('charge')")  # re-rendered, the amount focused again
        page.wait_for_timeout(50)
        self.assertEqual(page.evaluate("() => window.card.shadowRoot.activeElement?.name"), "amount")
        self.assertEqual(page.evaluate("() => window.scrollY"), 900)
        page.evaluate("() => { window.card.hass = { ...window.card._hass }; }")  # a state update
        page.wait_for_timeout(50)
        self.assertEqual(page.evaluate("() => window.scrollY"), 900)

    def test_status_pill_shows_its_whole_label_and_the_buttons_sit_at_the_banner_corner(self):
        page = self.page("fuel")
        for kind in ("fuel", "electric"):
            for width in (245, 300, 400, 500):
                for tag, zoom in (
                    ("vehicle-consumption-card", False),
                    ("vehicle-consumption-mini-card", False),
                    ("vehicle-consumption-mini-card", True),
                ):
                    with self.subTest(kind=kind, width=width, tag=tag, zoom=zoom):
                        self.assertEqual(page.evaluate(PILL, [shots.mock_hass(kind), tag, zoom, width]), [])


if __name__ == "__main__":
    unittest.main()

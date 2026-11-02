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


if __name__ == "__main__":
    unittest.main()

"""The screenshot comparator sees every channel: `python -m unittest discover -s scripts` (needs ffmpeg).

A comparison on the alpha channel alone (`ImageChops.difference(a, b).getbbox()` on RGBA) calls two opaque captures
of different colours identical, and a changed screenshot would be dropped. These tests pin the opposite.
"""

import importlib.util
import subprocess
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("screenshots", Path(__file__).with_name("screenshots.py"))
shots = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shots)


def image(path, rgba, *, size=(8, 8), frames=1, extra=()):
    """An image of one exact colour `rgba` (r, g, b, a), encoded by ffmpeg from raw pixels so no colour conversion
    rounds it; `extra`: encoder options (same pixels, other bytes)."""
    w, h = size
    raw = ["-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{w}x{h}", "-framerate", "10", "-i", "-"]
    subprocess.run(
        [shots.FFMPEG, "-nostdin", "-v", "error", "-y", *raw, "-frames:v", str(frames), *extra, str(path)],
        input=bytes(rgba) * (w * h * frames),
        check=True,
    )
    return path


class Comparator(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.tmp = Path(tmp.name)

    def written(self, old, new):
        """save() over a copy of `old`; when it says written, `out` holds the new render."""
        out = self.tmp / f"out{Path(old).suffix}"
        out.write_bytes(Path(old).read_bytes())
        rendered = Path(new).read_bytes()
        result = shots.save(new, out)
        self.assertEqual(out.read_bytes(), rendered if result else Path(old).read_bytes())
        return result

    def test_opaque_png_of_another_colour_is_rewritten(self):
        # Same (opaque) alpha everywhere: only the RGB channels differ.
        red = image(self.tmp / "red.png", (255, 0, 0, 255), extra=["-pix_fmt", "rgba"])
        blue = image(self.tmp / "blue.png", (0, 0, 255, 255), extra=["-pix_fmt", "rgba"])
        self.assertTrue(self.written(red, blue))

    def test_one_channel_one_step_is_rewritten(self):
        a = image(self.tmp / "a.png", (128, 128, 128, 255), extra=["-pix_fmt", "rgb24"])
        b = image(self.tmp / "b.png", (128, 128, 129, 255), extra=["-pix_fmt", "rgb24"])
        self.assertTrue(self.written(a, b))

    def test_translucent_png_same_alpha_other_colour_is_rewritten(self):
        a = image(self.tmp / "a.png", (0, 255, 0, 128), extra=["-pix_fmt", "rgba"])
        b = image(self.tmp / "b.png", (255, 0, 255, 128), extra=["-pix_fmt", "rgba"])
        self.assertTrue(self.written(a, b))

    def test_gif_with_another_colour_is_rewritten(self):
        a = image(self.tmp / "a.gif", (255, 0, 0, 255), frames=2)
        b = image(self.tmp / "b.gif", (0, 255, 0, 255), frames=2)
        self.assertTrue(self.written(a, b))

    def test_gif_noise_is_kept_but_not_more(self):
        # Chromium's run-to-run noise on a moving edge, through the GIF palette: a few values, a few units off.
        old = image(self.tmp / "old.gif", (100, 100, 100, 255), size=(32, 32), frames=2)
        base = shots.pixels(old)
        head = base.find(b"ENDHDR\n") + 7

        def noisy(values, units):
            out = bytearray(base)
            for k in range(values):
                out[head + 4 * k] += units  # the red channel of the first pixels
            return bytes(out)

        noise = shots.GIF_NOISE
        self.assertTrue(shots.same_pixels(base, noisy(noise["values"], noise["units"]), noise))
        self.assertFalse(shots.same_pixels(base, noisy(noise["values"] + 1, 1), noise))
        self.assertFalse(shots.same_pixels(base, noisy(1, noise["units"] + 1), noise))
        self.assertFalse(shots.same_pixels(base, noisy(1, 1)))  # no noise allowed: one unit is a change

    def test_gif_tinted_all_over_is_rewritten(self):
        # Every pixel 6 units off (as much as the noise seen in CI, but everywhere): a real change, not noise.
        exact = ["-vf", "split[a][b];[a]palettegen=reserve_transparent=0[p];[b][p]paletteuse=dither=none"]
        a = image(self.tmp / "a.gif", (100, 100, 100, 255), size=(64, 64), frames=2, extra=exact)
        b = image(self.tmp / "b.gif", (100, 100, 106, 255), size=(64, 64), frames=2, extra=exact)
        self.assertTrue(self.written(a, b))

    def test_png_noise_counts(self):
        # No tolerance on a PNG: one unit on one channel is a change.
        a = image(self.tmp / "a.png", (100, 100, 100, 255), extra=["-pix_fmt", "rgba"])
        b = image(self.tmp / "b.png", (100, 101, 100, 255), extra=["-pix_fmt", "rgba"])
        self.assertTrue(self.written(a, b))

    def test_gif_with_more_frames_is_rewritten(self):
        a = image(self.tmp / "a.gif", (255, 0, 0, 255), frames=2)
        b = image(self.tmp / "b.gif", (255, 0, 0, 255), frames=3)
        self.assertTrue(self.written(a, b))

    def test_same_pixels_other_bytes_are_kept(self):
        a = image(self.tmp / "a.png", (51, 102, 204, 255), extra=["-pix_fmt", "rgb24", "-compression_level", "0"])
        b = image(self.tmp / "b.png", (51, 102, 204, 255), extra=["-pix_fmt", "rgb24", "-compression_level", "9"])
        self.assertNotEqual(a.read_bytes(), b.read_bytes())
        self.assertFalse(self.written(a, b))
        self.assertFalse(b.exists())  # the new render is dropped

    def test_other_size_is_rewritten(self):
        a = image(self.tmp / "a.png", (51, 102, 204, 255), size=(8, 8), extra=["-pix_fmt", "rgb24"])
        b = image(self.tmp / "b.png", (51, 102, 204, 255), size=(8, 9), extra=["-pix_fmt", "rgb24"])
        self.assertTrue(self.written(a, b))


if __name__ == "__main__":
    unittest.main()

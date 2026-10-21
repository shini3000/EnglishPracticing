"""Release numbering stays deterministic and independent from application secrets."""

import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location(
    "release_version", Path(__file__).resolve().parents[1] / ".github/scripts/release-version.py"
)
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class ReleaseVersionTests(unittest.TestCase):
    def test_first_release_is_one(self):
        for bump in ("patch", "minor", "major"):
            self.assertEqual(release.next_version([], bump), "1.0.0")

    def test_increments_and_resets(self):
        tags = ["v1.2.9", "v1.10.3", "v1.9.8"]
        for bump, expected in (("patch", "1.10.4"), ("minor", "1.11.0"), ("major", "2.0.0")):
            self.assertEqual(release.next_version(tags, bump), expected)

    def test_ignores_unrelated_and_prerelease_tags(self):
        self.assertEqual(release.next_version(["v9.0.0-rc.1", "other", "v01.2.3"]), "1.0.0")

    def test_explicit_tag(self):
        self.assertEqual(release.next_version(["v1.0.0"], requested="v1.0.0"), "1.0.0")

    def test_refuses_bad_old_or_nonstable_tags(self):
        for tag in ("v0.9.0", "v1.0.0-rc.1", "1.0.0", "v01.0.0", "v1.0.0\n"):
            with self.assertRaises(ValueError):
                release.next_version([], requested=tag)
        with self.assertRaises(ValueError):
            release.next_version(["v2.0.0"], requested="v1.0.0")

    def test_refuses_unknown_bump(self):
        with self.assertRaises(ValueError):
            release.next_version([], "automatic")

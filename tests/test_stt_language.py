"""Guard both voice entry points without initializing providers or using quota."""
import ast
from pathlib import Path
import unittest


class TranscriptionLanguageTests(unittest.TestCase):
    def test_both_voice_paths_pin_english_and_disable_detection(self):
        root = Path(__file__).resolve().parents[1]
        for file in ("agent/tutor.py", "agent/drill_call.py"):
            with self.subTest(file=file):
                tree = ast.parse((root / file).read_text(encoding="utf-8"))
                calls = [node for node in ast.walk(tree) if isinstance(node, ast.Call)
                         and isinstance(node.func, ast.Attribute) and node.func.attr == "STT"
                         and isinstance(node.func.value, ast.Name) and node.func.value.id == "groq"]
                self.assertEqual(len(calls), 1)
                options = {kw.arg: kw.value for kw in calls[0].keywords}
                self.assertEqual(ast.literal_eval(options["language"]), "en")
                self.assertIs(ast.literal_eval(options["detect_language"]), False)

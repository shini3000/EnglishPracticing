import tempfile
import unittest
from pathlib import Path
from progress.pending import PendingEvidence


class PendingTests(unittest.TestCase):
    def test_survives_restart_deduplicates_and_isolates_learners(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "pending.sqlite3"
            queue = PendingEvidence(path)
            evidence = {"event_id": "one", "evidence": "I listened to music."}
            queue.add("learner-a", evidence)
            queue.add("learner-a", evidence)
            queue.add("learner-b", {"event_id": "two"})
            restarted = PendingEvidence(path)
            self.assertEqual(restarted.read("learner-a"), [evidence])
            restarted.acknowledge("learner-a", ["one"])
            self.assertEqual(restarted.read("learner-a"), [])
            self.assertEqual(len(restarted.read("learner-b")), 1)

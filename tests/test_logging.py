import json
import logging
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


class LoggingTests(unittest.TestCase):
    def test_real_file_context_redaction_and_rotation(self):
        with tempfile.TemporaryDirectory() as directory:
            code = '''
import logging
from utils.logger import configure_logging, bind_log_context, stop_logging
configure_logging()
configure_logging()
bind_log_context(session_id="session-test", room="test-room")
log = logging.getLogger("agent.test")
for i in range(12):
    log.info("request %s sensitive-test-key", i, extra={"request_id": "req-test"})
try:
    raise ValueError("failure sensitive-test-key")
except ValueError:
    log.exception("request.failed")
logging.getLogger("groq._base_client").debug("private transcript")
stop_logging()
'''
            result = subprocess.run([sys.executable, "-c", code], capture_output=True,
                text=True, timeout=30, env={**os.environ, "LOG_DIR": directory,
                "LOG_LEVEL": "INFO", "LOG_MAX_BYTES": "800", "LOG_BACKUP_COUNT": "3",
                "GOOGLE_API_KEY": "sensitive-test-key"})
            self.assertEqual(result.returncode, 0, result.stderr)
            files = list(Path(directory).glob("agent-*.jsonl*"))
            self.assertGreater(len(files), 1)
            self.assertLessEqual(len(files), 4)
            raw = "".join(p.read_text(encoding="utf-8") for p in files)
            self.assertNotIn("sensitive-test-key", raw)
            self.assertNotIn("private transcript", raw)
            records = [json.loads(line) for line in raw.splitlines()]
            self.assertTrue(all(r["session_id"] == "session-test" for r in records))
            self.assertTrue(any("ValueError" in r["message"] for r in records))

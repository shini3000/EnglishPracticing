"""Queued JSON logging; LiveKit owns console output, each PID owns its files."""
import atexit
import contextvars
import logging
from logging.handlers import QueueHandler, QueueListener, RotatingFileHandler
import os
from pathlib import Path
import queue
import re
from datetime import datetime, timezone
from pythonjsonlogger.json import JsonFormatter

_context = contextvars.ContextVar("log_context", default={})
_listener = None
_pid = None
_file = None


def bind_log_context(**fields):
    return _context.set({**_context.get(), **fields})


def reset_log_context(token):
    _context.reset(token)


class SafeContextFilter(logging.Filter):
    def __init__(self):
        super().__init__()
        self.secrets = tuple(v for k, v in os.environ.items()
                             if any(s in k.upper() for s in ("KEY", "SECRET", "PASSCODE", "DATABASE_URL"))
                             and len(v) >= 8)

    def clean(self, text):
        for value in self.secrets:
            text = text.replace(value, "[REDACTED]")
        text = re.sub(r"(?i)(Bearer\s+)\S+", r"\1[REDACTED]", text)
        return re.sub(r"(?i)postgres(?:ql)?://[^\s]+", "[REDACTED_DATABASE_URL]", text)

    def filter(self, record):
        for key, value in _context.get().items():
            if not hasattr(record, key):
                setattr(record, key, value)
        record.msg = self.clean(record.getMessage())
        record.args = ()
        if record.exc_info:
            record.exc_text = self.clean(logging.Formatter().formatException(record.exc_info))
        for key, value in list(record.__dict__.items()):
            if isinstance(value, str):
                record.__dict__[key] = self.clean(value)
        return True


class UTCJsonFormatter(JsonFormatter):
    def add_fields(self, log_data, record, message_dict):
        super().add_fields(log_data, record, message_dict)
        log_data["timestamp"] = datetime.fromtimestamp(record.created, timezone.utc).isoformat()
        log_data["service"] = "english-tutor-agent"


def stop_logging():
    global _listener, _file
    if _listener is not None:
        _listener.stop()
        _listener = None
    if _file is not None:
        _file.close()
        _file = None


def configure_logging(level=None):
    global _listener, _pid, _file
    root = logging.getLogger()
    for name in ("groq", "openai", "google", "httpx", "httpx2", "httpcore", "httpcore2"):
        logging.getLogger(name).setLevel(logging.WARNING)
    for handler in root.handlers:
        if not any(isinstance(f, SafeContextFilter) for f in handler.filters):
            handler.addFilter(SafeContextFilter())
    if _listener is not None and _pid == os.getpid():
        return
    selected = level or os.getenv("LOG_LEVEL", "INFO").upper()
    directory = Path(os.getenv("LOG_DIR", "logs"))
    directory.mkdir(parents=True, exist_ok=True)
    _pid = os.getpid()
    _file = RotatingFileHandler(directory / f"agent-{_pid}.jsonl",
        maxBytes=int(os.getenv("LOG_MAX_BYTES", "5242880")),
        backupCount=int(os.getenv("LOG_BACKUP_COUNT", "5")), encoding="utf-8")
    _file.setLevel(selected)
    _file.setFormatter(UTCJsonFormatter("%(levelname)s %(name)s %(message)s %(process)d %(threadName)s"))
    queued = QueueHandler(queue.SimpleQueue())
    queued.setLevel(selected)
    queued.addFilter(SafeContextFilter())
    root.addHandler(queued)
    root.setLevel(selected)
    _listener = QueueListener(queued.queue, _file, respect_handler_level=True)
    _listener.start()


atexit.register(stop_logging)

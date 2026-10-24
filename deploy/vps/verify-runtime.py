"""Run on the VPS from its deployment directory; redact private env values in logs."""
import re
import subprocess
from pathlib import Path
from urllib.parse import urlparse

secrets = set()
for filename in ("agent.env", "web.env"):
    for line in Path(filename).read_text().splitlines():
        key, sep, value = line.partition("=")
        if sep and value and re.search(r"(?:KEY|SECRET|PASSWORD|PASSCODE|TOKEN|DATABASE_URL)$", key):
            secrets.add(value)
            if "://" in value:
                password = urlparse(value).password
                if password:
                    secrets.add(password)


def redact(text):
    for value in sorted(secrets, key=len, reverse=True):
        text = text.replace(value, "[redacted]")
    return text


def docker(*args):
    result = subprocess.run(["sudo", "docker", "compose", *args], text=True, capture_output=True)
    return result, redact(result.stdout + result.stderr)


result, text = docker("ps")
print(text)
if result.returncode:
    raise SystemExit(result.returncode)

for service in ("agent", "proxy"):
    result, text = docker("logs", "--no-color", "--tail", "60", service)
    print(f"--- {service} logs (redacted) ---")
    print(text)

script = '''
Promise.all([
  fetch("http://127.0.0.1:3000/login"),
  fetch("http://127.0.0.1:3000/api/token", {
    method: "POST", headers: {"Content-Type": "application/json"}, body: "{}"
  }),
  fetch("http://127.0.0.1:3000/api/progress")
]).then(rs => {
  const statuses = rs.map(r => r.status);
  console.log("login/token/progress statuses: " + statuses.join("/"));
  process.exit(statuses.join("/") === "200/401/401" ? 0 : 1);
}).catch(() => process.exit(1));
'''
result, text = docker("exec", "-T", "web", "node", "-e", script)
print(text)
raise SystemExit(result.returncode)

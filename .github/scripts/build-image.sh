#!/usr/bin/env bash
set -euo pipefail

case "${1:-}" in
  agent) dockerfile=Dockerfile ;;
  web) dockerfile=web/Dockerfile ;;
  *) printf 'Expected image: agent or web\n' >&2; exit 1 ;;
esac

image="english-practicing-$1:${GITHUB_SHA:?GITHUB_SHA is required}"
docker build --pull --file "$dockerfile" --tag "$image" \
  --label "org.opencontainers.image.source=${SOURCE_URL:?SOURCE_URL is required}" \
  --label "org.opencontainers.image.revision=$GITHUB_SHA" .

user=$(docker image inspect --format '{{.Config.User}}' "$image")
case "$user" in
  ''|root|root:*|0|0:*) printf 'Image must not run as root\n' >&2; exit 1 ;;
esac

if [[ "$1" == agent ]]; then
  docker run --rm --network none \
    -e LIVEKIT_URL=wss://test.invalid \
    -e LIVEKIT_API_KEY=ci-placeholder-key \
    -e LIVEKIT_API_SECRET=ci-placeholder-secret \
    -e GROQ_API_KEY=ci-placeholder-groq \
    -e TAVILY_API_KEY=ci-placeholder-tavily \
    --entrypoint python "$image" -c '
import main
from pathlib import Path
assert not list(Path("/app").glob(".env*")), "Unexpected env file"
assert not Path("/app/.git").exists()
assert not Path("/app/.agents").exists()
print("Agent imports OK; no env files; worker not started")
'
else
  container="ci-web-${GITHUB_RUN_ID:-local}"
  cleanup() { docker logs "$container" || true; docker rm -f "$container" || true; }
  docker run --detach --name "$container" --network none "$image"
  trap cleanup EXIT
  docker exec "$container" node -e '
    const fs = require("fs");
    if (fs.readdirSync("/app").some(name => name.startsWith(".env"))) {
      throw new Error("Unexpected env file");
    }
    (async () => {
      for (let attempt = 0; attempt < 30; attempt++) {
        try {
          const response = await fetch("http://127.0.0.1:3000/login", {
            signal: AbortSignal.timeout(2000),
          });
          if (response.status === 200) {
            console.log("Web login page OK; no env files; no call started");
            return;
          }
        } catch {}
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      throw new Error("Web did not become healthy");
    })().catch(error => { console.error(error); process.exit(1); });
  '
fi

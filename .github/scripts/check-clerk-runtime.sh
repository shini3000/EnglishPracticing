#!/usr/bin/env bash
set -euo pipefail

# Reserved .invalid domain and fake keys. No credentials or external auth requests.
container="ci-clerk-${GITHUB_RUN_ID:-local}"
publishable="pk_test_$(printf 'clerk.invalid$' | base64 | tr -d '\n')"
cleanup() { docker logs "$container" || true; docker rm -f "$container" || true; }
docker run --detach --name "$container" --network none \
  -e "CLERK_PUBLISHABLE_KEY=$publishable" \
  -e CLERK_SECRET_KEY=sk_test_integration_placeholder \
  -e CLERK_AUTHORIZED_PARTIES=http://127.0.0.1:3000 \
  "$1"
trap cleanup EXIT

docker exec "$container" node -e '
  (async () => {
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const response = await fetch("http://127.0.0.1:3000/login", {
          redirect: "manual", signal: AbortSignal.timeout(2000),
        });
        if (response.status === 200) {
          const html = await response.text();
          if (!html.includes(process.env.CLERK_PUBLISHABLE_KEY)) {
            throw new Error("Runtime publishable key was not delivered to Clerk");
          }
          if (html.includes(process.env.CLERK_SECRET_KEY)) {
            throw new Error("Private key leaked into HTML");
          }
          for (const path of ["token", "progress", "learning-progress", "practice-journal"]) {
            const denied = await fetch(`http://127.0.0.1:3000/api/${path}`, {
              method: path === "token" ? "POST" : "GET",
              redirect: "manual", signal: AbortSignal.timeout(2000),
            });
            if (denied.status !== 401) throw new Error(`Anonymous ${path}: ${denied.status}`);
          }
          console.log("Clerk runtime config OK; secret absent from HTML; anonymous data/calls denied");
          return;
        }
      } catch (error) {
        if (attempt === 29) throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error("Clerk runtime setup did not become healthy");
  })().catch(error => { console.error(error); process.exit(1); });
'

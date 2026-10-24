"""Prepare ignored VPS env files from this checkout without printing secret values."""
import argparse
import re
from pathlib import Path
from urllib.parse import urlparse

from dotenv import dotenv_values


def write_env(path, values):
    lines = []
    for name, value in sorted(values.items()):
        if value is None:
            continue
        if "\n" in value or "\r" in value:
            raise ValueError(f"Multiline value is not supported: {name}")
        lines.append(f"{name}={value}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--domain", required=True)
    parser.add_argument("--image-tag", required=True)
    args = parser.parse_args()
    if not re.fullmatch(r"[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?", args.domain):
        raise ValueError("Use a DNS hostname without a URL scheme")
    if not re.fullmatch(r"[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,127}", args.image_tag):
        raise ValueError("Invalid Docker image tag")

    target = Path(__file__).resolve().parent
    root = target.parent.parent
    agent_source = dotenv_values(root / ".env", interpolate=False)
    web_source = {
        **dotenv_values(root / "web/.env", interpolate=False),
        **dotenv_values(root / "web/.env.local", interpolate=False),
    }
    agent_names = set(re.findall(r"^    ([A-Z][A-Z0-9_]*):", (root / "config/settings.py").read_text(), re.M))
    web_names = {
        "LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "DATABASE_URL",
        "CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "AVATAR_PASSCODE",
        "CORRECTION_PROVIDER", "CORRECTION_MODEL", "CORRECTION_MAX_REQUEST_TOKENS",
        "CORRECTION_MAX_COMPLETION_TOKENS", "DEEPSEEK_API_KEY", "DEEPSEEK_LLM_MODEL",
        "GROQ_API_KEY", "STT_MODEL", "GOOGLE_API_KEY", "GOOGLE_LLM_MODEL", "LLM_MODEL",
    }
    agent = {key: val for key, val in agent_source.items() if key in agent_names}
    web = {key: val for key, val in web_source.items() if key in web_names}
    for label, values, required in (
        ("agent", agent, ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "GROQ_API_KEY", "TAVILY_API_KEY", "PROGRESS_DATABASE_URL"]),
        ("web", web, ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "DATABASE_URL", "CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"]),
    ):
        missing = [key for key in required if not values.get(key)]
        if missing:
            raise ValueError(f"Missing {label} settings: {', '.join(missing)}")
    for key in ("LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"):
        if agent[key] != web[key]:
            raise ValueError(f"Agent and web settings differ: {key}")
    if urlparse(agent["LIVEKIT_URL"]).scheme != "wss":
        raise ValueError("The deployment requires a secure wss LiveKit URL")
    # Compare DB endpoints without printing passwords or requiring identical query strings.
    agent_db = urlparse(agent["PROGRESS_DATABASE_URL"])
    web_db = urlparse(web["DATABASE_URL"])
    if (agent_db.hostname, agent_db.path) != (web_db.hostname, web_db.path):
        raise ValueError("Agent and web database endpoints differ")
    provider_keys = {"groq": "GROQ_API_KEY", "google": "GOOGLE_API_KEY", "deepseek": "DEEPSEEK_API_KEY"}
    for label, values, settings in (
        ("agent", agent, [("LLM_PROVIDER", "groq"), ("GRADING_PROVIDER", "groq"), ("CORRECTION_PROVIDER", None)]),
        ("web", web, [("CORRECTION_PROVIDER", "deepseek")]),
    ):
        for setting, default in settings:
            provider = values.get(setting) or default
            if provider and (provider not in provider_keys or not values.get(provider_keys[provider])):
                raise ValueError(f"Provider key missing or unsupported provider: {label}.{setting}")

    web["AGENT_NAME"] = ""
    web["CLERK_AUTHORIZED_PARTIES"] = f"https://{args.domain}"
    for name in (".env", "agent.env", "web.env"):
        if (target / name).exists():
            raise FileExistsError(f"Preserving existing deployment file: {name}")
    write_env(target / "agent.env", agent)
    write_env(target / "web.env", web)
    write_env(target / ".env", {"DOMAIN": args.domain, "IMAGE_TAG": args.image_tag})
    mode = "development" if web["CLERK_PUBLISHABLE_KEY"].startswith("pk_test_") else "production"
    print(f"Prepared ignored env files. Clerk mode: {mode}. No secret values printed.")


if __name__ == "__main__":
    main()

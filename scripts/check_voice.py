"""Small live provider checks; never print credentials."""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from dotenv import load_dotenv
load_dotenv()
import edge_tts
from groq import AsyncGroq
from prompts.tutor import tutor_prompt


async def main():
    prompt = tutor_prompt("Ahmad")
    print("Prompt characters:", len(prompt))
    try:
        response = await AsyncGroq().chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[{"role": "system", "content": prompt},
                      {"role": "user", "content": "Greet briefly in Spanish."}],
            max_completion_tokens=80, reasoning_effort="low",
        )
        print("Groq succeeded; text present:", bool(response.choices[0].message.content))
    except Exception as exc:
        print("Groq diagnostic:", type(exc).__name__, str(exc)[:1200])
    try:
        size = 0
        async for part in edge_tts.Communicate(
            "Hola, vamos a practicar inglés.", "en-US-AndrewMultilingualNeural"
        ).stream():
            if part["type"] == "audio":
                size += len(part["data"])
        print("TTS bytes:", size)
    except Exception as exc:
        print("TTS diagnostic:", type(exc).__name__, str(exc)[:250])


if __name__ == "__main__":
    asyncio.run(main())

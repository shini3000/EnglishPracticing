"""Small live provider checks; never print credentials."""
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from dotenv import load_dotenv
load_dotenv()
import edge_tts
from groq import AsyncGroq
from prompts.tutor import tutor_prompt
import main as agent_bootstrap  # Windows inference stub before loading tutor plugins.
from agent import personas
from agent.practice import Practice
from agent.tutor import EnglishTutor
from agent.quota import compact_context, request_tokens
from livekit.agents import llm
from livekit.agents.llm.utils import build_legacy_openai_schema
from config.settings import settings


async def main():
    prompt = tutor_prompt("Ahmad")
    print("Prompt characters:", len(prompt))
    async def publish_data(*args, **kwargs):
        pass
    room = type("Room", (), {"name": "diagnostic", "local_participant": type(
        "Participant", (), {"publish_data": staticmethod(publish_data)})()})()
    practice = Practice(None, room, None, "daily", "es")
    tutor = EnglishTutor(personas.MALE, practice, "")
    tools = list(tutor.tools)
    history = llm.ChatContext.empty()
    for _ in range(100):
        history.add_message(role="user", content="I want to talk about university and my work. " * 20)
        history.add_message(role="assistant", content="Tell me about a new experience at work. " * 10)
    history.add_message(role="user", content="Yesterday I did went to work. Please explain the grammar in Spanish.")
    schemas = [build_legacy_openai_schema(tool) for tool in tools]
    allowance = settings.GROQ_MAX_REQUEST_TOKENS - settings.GROQ_MAX_COMPLETION_TOKENS - request_tokens(llm.ChatContext.empty(), tools)
    context = compact_context(history, prompt, "Current objective: past simple; ask recovery after correction.", allowance)
    print("Full history items:", len(history.items), "Sent items:", len(context.items))
    print("Estimated request tokens:", request_tokens(context, tools) + settings.GROQ_MAX_COMPLETION_TOKENS)
    try:
        client = AsyncGroq(max_retries=0)
        messages = [{"role": item.role, "content": item.text_content} for item in context.items]
        response = await client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=messages, tools=schemas,
            max_completion_tokens=settings.GROQ_MAX_COMPLETION_TOKENS, reasoning_effort="low",
        )
        message = response.choices[0].message
        print("Groq succeeded; text present:", bool(message.content),
              "Tool calls:", len(message.tool_calls or []))
        if response.usage:
            print("Actual input tokens:", response.usage.prompt_tokens,
                  "Output tokens:", response.usage.completion_tokens)
        if message.tool_calls:
            messages.append(message.model_dump(exclude_none=True))
            for call in message.tool_calls:
                tool = next(tool for tool in tools if tool.info.name == call.function.name)
                if call.function.name not in {"record_learning", "practice_control"}:
                    result = "Live diagnostic does not execute external search."
                else:
                    result = await tool(**json.loads(call.function.arguments))
                messages.append({"role": "tool", "tool_call_id": call.id, "content": result})
            followup = await client.chat.completions.create(
                model=settings.LLM_MODEL, messages=messages, tools=schemas,
                max_completion_tokens=settings.GROQ_MAX_COMPLETION_TOKENS, reasoning_effort="low",
            )
            print("Tool follow-up succeeded; spoken explanation present:",
                  bool(followup.choices[0].message.content))
        await client.close()
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

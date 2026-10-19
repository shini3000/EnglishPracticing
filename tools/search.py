"""
Web search, exposed to the LLM as a function tool.

Tavily returns bounded source snippets; generated answers are disabled because
the conversational model already synthesizes the reply.
"""
import logging
import re
import json
import httpx

from livekit.agents import RunContext, function_tool
from tavily import AsyncTavilyClient
from tavily.errors import TimeoutError as TavilyTimeoutError

from config.settings import settings

logger = logging.getLogger(__name__)

# Tavily's own deadline. Past this the caller is left listening to filler speech,
# which gets awkward; better to fail and let Ahmad say so.
_SEARCH_TIMEOUT = 15.0

# Three hits is plenty of context for a two-sentence spoken answer.
_MAX_RESULTS = 3

# Long page extracts blow up the prompt for no gain — the answer summary carries
# most of the signal, and these are only there to back it up.
_MAX_SNIPPET_CHARS = 300

_MD_LINK_RE = re.compile(r"\[([^\]]*)\]\([^)]*\)")  # [text](url) -> text
_BARE_URL_RE = re.compile(r"https?://\S+")
_WHITESPACE_RE = re.compile(r"\s+")

_client = AsyncTavilyClient(api_key=settings.TAVILY_API_KEY)


def _filler_source(query: str):
    """
    Build the `with_filler` callable that tells the user a search is underway.

    Fires only while the session is idle, so it never talks over the user. The
    first line names the query — the whole point is that the user knows *what*
    the pause is for. Later lines just reassure.
    """
    lines = (
        f"Let me search the web for {query}. One moment.",
        "Still searching, hang on.",
    )

    def source(step: int) -> str | None:
        return lines[step] if step < len(lines) else None

    return source


def _clean(text: str) -> str:
    """
    Strip the parts of a page extract that must never reach TTS.

    Real Tavily snippets are littered with markdown links and bare URLs
    ("[5 References](https://en.wikipedia.org/...)"). The prompt tells the LLM not
    to read links aloud, but the safest way to keep a URL out of the audio is to
    not hand it one. Markdown link text is kept; the target is dropped.
    """
    text = _MD_LINK_RE.sub(r"\1", text)
    text = _BARE_URL_RE.sub("", text)
    return _WHITESPACE_RE.sub(" ", text).strip()


def _format(query: str, data: dict) -> str:
    """
    Flatten a Tavily response into something the LLM can speak from.

    Tavily's synthesized `answer` is already a clean couple of sentences — exactly
    the shape of a voice reply — so when it's there, it is the whole payload. The
    raw snippets are only worth their noise when there is no answer to fall back on.
    """
    answer = (data.get("answer") or "").strip()
    if answer:
        return f"Search result: {answer}"

    snippets: list[str] = []
    for result in data.get("results") or []:
        content = _clean(result.get("content") or "")[:_MAX_SNIPPET_CHARS]
        if content:
            title = _clean(result.get("title") or "") or "Untitled"
            snippets.append(f"- {title}: {content}")
        if len(snippets) == _MAX_RESULTS:
            break

    if not snippets:
        return f"The web search for {query!r} returned no results."

    return "Search results:\n" + "\n".join(snippets)


@function_tool
async def search_web(ctx: RunContext, query: str) -> str:
    """Search current facts or explicit lookup requests, never ordinary grammar practice."""
    logger.info("Web search: %s", query)

    try:
        async with ctx.with_filler(_filler_source(query), interval=7.0, max_steps=2):
            data = await _client.search(
                query,
                search_depth="basic",
                max_results=_MAX_RESULTS,
                include_answer=False,  # raw sources: the tutor already synthesizes the reply
                timeout=_SEARCH_TIMEOUT,
            )
    # Tavily wraps httpx.TimeoutException in its own TimeoutError, which is unrelated
    # to the builtin — catching asyncio.TimeoutError here would never fire.
    except TavilyTimeoutError:
        logger.warning("Web search timed out: %s", query)
        return f"The web search for {query!r} timed out. Tell the user you couldn't reach the web."
    except Exception:
        logger.exception("Web search failed: %s", query)
        return f"The web search for {query!r} failed. Tell the user you couldn't reach the web."

    return _format(query, data)


@function_tool
async def find_listening_video(ctx: RunContext, topic: str) -> str:
    """Find and show a listening video. Learner must confirm playback, captions and duration."""
    try:
        data = await _client.search(
            topic + " English short video 2 6 minutes subtitles",
            include_domains=["youtube.com", "bbc.co.uk", "ted.com"],
            max_results=3, timeout=_SEARCH_TIMEOUT,
        )
        async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
            for result in data.get("results", []):
                url = result.get("url", "")
                parsed = httpx.URL(url)
                if parsed.scheme != "https" or parsed.host not in {
                    "youtube.com", "www.youtube.com", "www.bbc.co.uk", "bbc.co.uk", "www.ted.com", "ted.com"
                }:
                    continue
                response = await client.get(url)
                if response.status_code != 200:
                    continue
                material = {"url": url, "title": result.get("title", "Listening video"),
                            "note": "Página accesible; confirma reproducción, duración y subtítulos."}
                await ctx.session.room_io.room.local_participant.publish_data(
                    json.dumps(material).encode(), reliable=True, topic="practice-material"
                )
                return json.dumps(material)
    except Exception:
        logger.warning("Listening material lookup failed", exc_info=True)
    return "No verified link available. Reserve 5–10 minutes to choose with learner or use their audio. Mark listening pending until played."

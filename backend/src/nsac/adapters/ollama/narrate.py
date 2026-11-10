"""Optional local LLM narration via Ollama. The pipeline works without it.

Root AGENTS.md: fully offline; Qwen models pulled on the demo laptop, OLLAMA_MODEL
picks the tag. Failure here never blocks the deterministic path.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

DEFAULT_BASE_URL = "http://127.0.0.1:11434"
DEFAULT_MODEL = "qwen3.5:9b"  # placeholder tag; set OLLAMA_MODEL to the pulled tag

_TIMEOUT_S = 30.0


def narrate(
    rationale: str,
    metric_summaries: list[str],
    *,
    base_url: str | None = None,
    model: str | None = None,
) -> str | None:
    """Return a one-paragraph explanation, or None when Ollama is unavailable."""
    base = base_url or os.environ.get("OLLAMA_BASE_URL", DEFAULT_BASE_URL)
    tag = model or os.environ.get("OLLAMA_MODEL", DEFAULT_MODEL)
    prompt = (
        "You are an assistant for astronauts. Explain in at most 3 short sentences "
        "why the following action is proposed. Plain text, no numbers you invent, "
        "use only the given facts.\n"
        f"Signals: {'; '.join(metric_summaries)}\n"
        f"Proposed action rationale: {rationale}"
    )
    body = json.dumps(
        {"model": tag, "messages": [{"role": "user", "content": prompt}], "stream": False}
    ).encode()
    request = urllib.request.Request(
        f"{base}/api/chat",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=_TIMEOUT_S) as response:
            payload = json.loads(response.read())
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, KeyError):
        return None
    content = payload.get("message", {}).get("content")
    return content.strip() if isinstance(content, str) and content.strip() else None


__all__ = ["DEFAULT_BASE_URL", "DEFAULT_MODEL", "narrate"]

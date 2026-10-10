"""Gemma 4 adapter. Talks to any OpenAI-compatible chat endpoint (Ollama, llama.cpp server,
vLLM, a hosted gateway). If GEMMA_BASE_URL is empty, every call returns None and the
caller falls back to templates. All model output is validated before use."""
import json
import os
import re

import httpx
from pydantic import BaseModel, ValidationError

from models import OutreachDraft

BASE = os.getenv("GEMMA_BASE_URL", "").rstrip("/")
MODEL = os.getenv("GEMMA_MODEL", "gemma-4")
KEY = os.getenv("GEMMA_API_KEY", "")
TIMEOUT = float(os.getenv("GEMMA_TIMEOUT", "60"))

SYSTEM = ("You are EasyWrite.AI, a cautious campus sponsorship assistant. Use ONLY the facts supplied. "
          "Never invent metrics, contacts, past partnerships, discounts, legal terms or commitments. "
          "Never promise attendee data or exclusivity. Placeholders like [Your name] must stay as written. "
          "Return one JSON object and nothing else.")


def enabled() -> bool:
    return bool(BASE)


def _chat(system: str, user: str) -> str:
    headers = {"Authorization": f"Bearer {KEY}"} if KEY else {}
    r = httpx.post(f"{BASE}/v1/chat/completions", headers=headers, timeout=TIMEOUT, json={
        "model": MODEL, "temperature": 0.4, "response_format": {"type": "json_object"},
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]})
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


def _parse(text: str) -> dict:
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    return json.loads(text)


def ask_json(system: str, user: str, schema: type[BaseModel], retries: int = 1):
    """Returns a validated model instance, or None if Gemma is off or keeps failing."""
    if not enabled():
        return None
    for _ in range(retries + 1):
        try:
            return schema.model_validate(_parse(_chat(system, user)))
        except (httpx.HTTPError, KeyError, ValueError, ValidationError):
            continue
    return None


def draft_outreach(facts: dict, tone: str):
    user = (f"Tone: {tone}.\nFACTS (the only allowed source):\n{json.dumps(facts, ensure_ascii=False)}\n\n"
            "Write a sponsor-specific outreach set. Explain what the sponsor gains before asking. "
            'Return JSON with exactly these string keys: "subject", "email", "linkedin", "whatsapp", '
            '"follow1", "follow2". follow1 and follow2 start with "Subject: ". Sign off with [Your name] / [Your club].')
    return ask_json(SYSTEM, user, OutreachDraft)


class EventExtract(BaseModel):
    name: str
    category: str
    description: str
    audience: str
    attendees: int
    city: str
    date: str = ""
    target: int
    benefits: list[str]


def extract_event(text: str):
    from models import BENEFITS, CATEGORIES
    user = (f"Extract an event profile from this brief. Use only what it states; if a field is missing, "
            f"use an empty string or 0.\ncategory must be one of {CATEGORIES}.\n"
            f"benefits must be a subset of {BENEFITS}.\ndate as YYYY-MM-DD.\n"
            'Keys: "name","category","description","audience","attendees","city","date","target","benefits".\n\n'
            f"BRIEF:\n{text}")
    return ask_json(SYSTEM, user, EventExtract)


def unsupported_numbers(output: str, facts: dict) -> list[str]:
    """Numbers in the draft that do not appear in the supplied facts."""
    norm = lambda t: re.sub(r"[,\s]", "", t)
    allowed = {norm(n) for n in re.findall(r"\d[\d,]*", json.dumps(facts, ensure_ascii=False))}
    found = {norm(n) for n in re.findall(r"\d[\d,]*", output)}
    return sorted(n for n in found if len(n) > 2 and n not in allowed)

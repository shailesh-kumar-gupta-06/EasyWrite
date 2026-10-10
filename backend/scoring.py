"""Fit scoring and packages. Mirrors scoreFit() / buildPackages() in the frontend,
so the browser and the API always show the same numbers."""
import json
import math
from pathlib import Path

WEIGHTS = {"audience": 35, "theme": 25, "goals": 20, "geography": 10, "budget": 10}
GOAL_MAP = {
    "Recruit talent": "Recruitment access", "Brand awareness": "Logo placement",
    "Student engagement": "Workshops", "Product demos": "Booth space",
    "Thought leadership": "Speaking opportunities", "Social reach": "Social media promotion",
}
SPONSORS = json.loads((Path(__file__).parent / "data" / "sponsors.json").read_text(encoding="utf-8"))
BY_ID = {s["id"]: s for s in SPONSORS}


def jsround(x: float) -> int:  # JS Math.round (half up), not Python's banker's rounding
    return int(math.floor(x + 0.5))


def inr(n) -> str:
    n = int(n)
    s = f"{n:,}"  # western grouping first, then convert to Indian grouping
    if n >= 1000:
        head, tail = str(n)[:-3], str(n)[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:]); head = head[:-2]
        if head:
            groups.insert(0, head)
        s = ",".join(groups + [tail])
    return "₹" + s


def score_fit(ev, s: dict) -> dict:
    W = WEIGHTS
    text = f"{ev.audience} {ev.description} {ev.name}".lower()
    parts, missing = [], []

    m = sum(1 for k in s["audiences"] if k in text)
    p = 0
    if not ev.audience.strip():
        missing.append("Target audience not provided")
    else:
        p = jsround(W["audience"] * min(1, m / 3))
    parts.append({"label": "Audience alignment", "pts": p, "max": W["audience"],
                  "why": f"{m} of the sponsor's audience keywords appear in the event text."})

    exact = ev.category in s["themes"]
    near = any(t.lower() in text for t in s["themes"])
    p = W["theme"] if exact else (jsround(W["theme"] * 0.4) if near else 0)
    parts.append({"label": "Event/theme alignment", "pts": p, "max": W["theme"],
                  "why": f'"{ev.category}" matches a sponsor theme.' if exact
                  else "Category is not a listed theme for this sponsor."})

    wanted = [GOAL_MAP[g] for g in s["goals"]]
    hit = sum(1 for b in wanted if b in ev.benefits)
    if not ev.benefits:
        missing.append("No sponsorship benefits selected")
    p = jsround(W["goals"] * hit / len(s["goals"]))
    parts.append({"label": "Sponsor goal match", "pts": p, "max": W["goals"],
                  "why": f"{hit} of {len(s['goals'])} sponsor goals map to benefits you can offer."})

    c = ev.city.strip().lower()
    if not c:
        missing.append("Event city not provided")
    same = s["city"].lower() == c
    p = 0 if not c else W["geography"] if same else {"national": 6, "regional": 4}.get(s["reach"], 1)
    parts.append({"label": "Geography/relationship", "pts": p, "max": W["geography"],
                  "why": "Cannot assess without a city." if not c else
                  "Sponsor is based in the same city." if same else
                  f"Sponsor operates at a {s['reach']} level (based in {s['city']})."})

    t = ev.target
    if not t:
        missing.append("Funding target not provided")
    p = 0 if not t else W["budget"] if t <= s["max"] else 5 if t <= s["max"] * 1.5 else 0
    parts.append({"label": "Budget feasibility", "pts": p, "max": W["budget"],
                  "why": "Cannot assess without a funding target." if not t else
                  f"Demo budget range {inr(s['min'])}–{inr(s['max'])} vs. your target {inr(t)}."})

    missing.append("Sponsor contact and past sponsorship history are unknown")
    return {"total": sum(x["pts"] for x in parts), "parts": parts, "missing": missing}


def build_packages(ev, s: dict) -> list[dict]:
    t = ev.target or 50000
    cap, b = s["max"], ev.benefits

    def rng(a, z):
        lo = max(s["min"], jsround(t * a / 1000) * 1000)
        hi = max(lo, min(cap, jsround(t * z / 1000) * 1000))
        return [lo, hi]

    wanted = [x for x in (GOAL_MAP[g] for g in s["goals"]) if x in b]
    def why(lvl):
        link = "line up with: " + ", ".join(wanted) if wanted else "do not clearly match your listed benefits"
        return f"Sponsor goals ({', '.join(s['goals'])}) {link}. {lvl}"

    return [
        {"id": "community", "name": "Community Partner", "range": rng(.03, .1), "benefits": b[:2],
         "why": why("A lighter commitment to start the relationship.")},
        {"id": "supporting", "name": "Supporting Sponsor", "range": rng(.15, .3), "benefits": b[:4],
         "why": why("Balanced visibility for the support requested.")},
        {"id": "title", "name": "Title Sponsor", "range": rng(.4, .7), "benefits": list(b),
         "why": why(f"Full visibility across ~{ev.attendees} attendees.")},
    ]

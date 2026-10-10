"""EasyWrite.AI API.  Run:  uvicorn main:app --reload --port 8000   (from the backend folder)"""
import os
import secrets
import string
from datetime import date

from dotenv import load_dotenv

load_dotenv()  # must run before importing gemma (it reads env at import time)

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

import db
import gemma
from models import BriefIn, CertBatch, Certificate, Event, OutreachRequest, Prospect, ProspectPatch
from outreach import template_outreach
from scoring import BY_ID, SPONSORS, build_packages, score_fit

app = FastAPI(title="EasyWrite.AI API", version="0.1.0")
# Local demo default is open. Set APP_ORIGIN (comma separated) before any public deployment.
origins = [o.strip() for o in os.getenv("APP_ORIGIN", "*").split(",")]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"])
db.init()


def _event(event_id: str) -> Event:
    doc = db.get("events", event_id)
    if not doc:
        raise HTTPException(404, f"Event '{event_id}' not found. POST it to /api/events first.")
    return Event(**doc)


@app.get("/api/health")
def health():
    return {"ok": True, "gemma": gemma.enabled(), "model": gemma.MODEL if gemma.enabled() else None}


@app.get("/api/sponsors")
def sponsors():
    return SPONSORS  # fictional demo data


# ---- events ----
@app.post("/api/events")
def save_event(ev: Event):
    ev.id = ev.id or "e" + secrets.token_hex(4)
    db.put("events", ev.id, ev.model_dump())
    return ev


@app.get("/api/events")
def list_events():
    return db.all_("events")


@app.delete("/api/events/{event_id}")
def delete_event(event_id: str):
    if not db.delete("events", event_id):
        raise HTTPException(404, "Event not found")
    for p in db.all_("prospects"):
        if p.get("eventId") == event_id:
            db.delete("prospects", p["id"])
    for c in db.all_("certs"):
        if c.get("eventId") == event_id:
            db.delete("certs", c["id"])
    return {"deleted": event_id}


@app.post("/api/events/extract")
def extract(brief: BriefIn):
    """Gemma turns pasted brief text into a draft event profile. The user must review it."""
    if not gemma.enabled():
        raise HTTPException(503, "Gemma is not configured. Set GEMMA_BASE_URL in .env.")
    out = gemma.extract_event(brief.text)
    if out is None:
        raise HTTPException(502, "The model did not return a valid profile. Try again or fill the form manually.")
    return {"draft": out, "note": "Review every field before saving. Nothing is saved yet."}


# ---- sponsor fit ----
@app.get("/api/events/{event_id}/sponsor-fits")
def sponsor_fits(event_id: str, explain: bool = Query(False, description="Add a Gemma explanation to the top 3")):
    ev = _event(event_id)
    fits = []
    for s in SPONSORS:
        f = score_fit(ev, s)
        fits.append({"id": f"{event_id}:{s['id']}", "sponsorId": s["id"], "sponsor_name": s["name"],
                     "category": s["industry"], "fit_score": f["total"], "parts": f["parts"],
                     "evidence_gaps": f["missing"],
                     "packages": build_packages(ev, s)})
    fits.sort(key=lambda x: x["fit_score"], reverse=True)
    if explain and gemma.enabled():
        from pydantic import BaseModel

        class Why(BaseModel):
            summary: str
        for f in fits[:3]:
            facts = {"event": ev.model_dump(), "sponsor": BY_ID[f["sponsorId"]], "score": f["fit_score"],
                     "components": f["parts"], "missing": f["evidence_gaps"]}
            out = gemma.ask_json(gemma.SYSTEM, "Explain in 2 plain sentences why this sponsor may or may not fit, "
                                 'using only these facts. Return {"summary": "..."}.\n' + str(facts), Why)
            f["ai_summary"] = out.summary if out else None
    return fits


# ---- outreach ----
@app.post("/api/sponsor-fits/{fit_id}/outreach")
def outreach(fit_id: str, req: OutreachRequest):
    """fit_id is '<eventId>:<sponsorId>'. Returns subject/email/linkedin/whatsapp/follow1/follow2."""
    event_id, _, sponsor_id = fit_id.partition(":")
    s = BY_ID.get(sponsor_id)
    if not s:
        raise HTTPException(404, f"Unknown sponsor '{sponsor_id}'")
    ev = req.event or _event(event_id)
    pkg = req.package
    facts = {"event": {k: v for k, v in ev.model_dump().items() if k != "id"},
             "sponsor": {k: s[k] for k in ("name", "industry", "goals", "city")},
             "package": pkg.model_dump() if pkg else None, "channel": req.channel}

    source, flags, draft = "template", [], None
    ai = gemma.draft_outreach(facts, req.tone)
    if ai:
        draft, source = ai.model_dump(), "gemma"
        text = " ".join(draft.values())
        bad = gemma.unsupported_numbers(text, facts)
        if bad:
            flags.append(f"The draft mentions numbers that are not in your event facts: {', '.join(bad)}")
    elif gemma.enabled():
        flags.append("The AI model did not return a valid draft, so a template was used instead.")
    if draft is None:
        draft = template_outreach(ev, s, pkg, req.tone)

    flags.append("Confirm the attendee count and package price before sending.")
    flags.append("Sponsor details are fictional demo data. Verify a real contact before outreach.")
    return {**draft, "source": source, "risk_flags": flags}


# ---- pipeline ----
@app.post("/api/prospects")
def save_prospect(p: Prospect):
    db.put("prospects", p.id, p.model_dump())
    return p


@app.get("/api/prospects")
def list_prospects():
    return db.all_("prospects")


@app.patch("/api/prospects/{prospect_id}")
def patch_prospect(prospect_id: str, patch: ProspectPatch):
    doc = db.get("prospects", prospect_id)
    if not doc:
        raise HTTPException(404, "Prospect not found. POST it to /api/prospects first.")
    doc.update(patch.model_dump(exclude_none=True))
    db.put("prospects", prospect_id, doc)
    return doc


@app.delete("/api/prospects/{prospect_id}")
def delete_prospect(prospect_id: str):
    if not db.delete("prospects", prospect_id):
        raise HTTPException(404, "Prospect not found")
    return {"deleted": prospect_id}


# ---- event details ----
@app.get("/api/events/{event_id}/summary")
def event_summary(event_id: str):
    """Numbers behind the Event Details page."""
    ev = _event(event_id)
    recs = [p for p in db.all_("prospects") if p.get("eventId") == event_id]
    return {"event": ev, "sponsors_in_pipeline": len(recs),
            "confirmed": sum(1 for p in recs if p["status"] == "Confirmed"),
            "certificates": sum(1 for c in db.all_("certs") if c.get("eventId") == event_id),
            "sponsor_status": [{"sponsorId": p["sponsorId"], "name": BY_ID.get(p["sponsorId"], {}).get("name"),
                                "status": p["status"]} for p in recs]}


# ---- certificates ----
def _numbers() -> set[str]:
    return {c.get("number") for c in db.all_("certs")}


def _new_number(taken: set[str]) -> str:
    while True:
        n = "EW-" + "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
        if n not in taken:
            taken.add(n)
            return n


@app.post("/api/events/{event_id}/certificates")
def create_certificates(event_id: str, req: CertBatch):
    """One certificate per name. Numbers are generated here so they are unique across the database."""
    ev = req.event or _event(event_id)
    taken, made = _numbers(), []
    for name in req.names:
        c = {"id": "c" + secrets.token_hex(4), "eventId": event_id, "name": name, "role": req.role,
             "issuer": req.issuer, "eventName": ev.name, "category": ev.category, "date": ev.date,
             "city": ev.city, "number": _new_number(taken), "issued": date.today().isoformat()}
        db.put("certs", c["id"], c)
        made.append(c)
    return made


@app.post("/api/certificates")
def save_certificate(c: Certificate):
    """Upsert one existing certificate (used to sync records made while offline)."""
    db.put("certs", c.id, c.model_dump())
    return c


@app.get("/api/events/{event_id}/certificates")
def list_certificates(event_id: str):
    return [c for c in db.all_("certs") if c.get("eventId") == event_id]


@app.delete("/api/certificates/{cert_id}")
def delete_certificate(cert_id: str):
    if not db.delete("certs", cert_id):
        raise HTTPException(404, "Certificate not found")
    return {"deleted": cert_id}

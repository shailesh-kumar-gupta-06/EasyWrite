import os, sys, tempfile
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
os.environ["DATABASE_PATH"] = os.path.join(tempfile.mkdtemp(), "t.db")
os.environ["GEMMA_BASE_URL"] = ""

import pytest
from fastapi.testclient import TestClient
import gemma, main
from models import Event, OutreachDraft
from scoring import SPONSORS, inr, score_fit

client = TestClient(main.app)
EVENT = {"id": "e1", "name": "CodeSprint 2026 (sample)", "category": "Technology",
         "description": "24-hour campus hackathon for beginner and intermediate student developers.",
         "audience": "College students, developers, beginners", "attendees": 300, "city": "Durg",
         "date": "2026-11-24", "target": 100000,
         "benefits": ["Logo placement", "Booth space", "Social media promotion", "Recruitment access"]}


def test_scores_match_frontend():  # values produced by the frontend's scoreFit() for this event
    ev = Event(**EVENT)
    got = {s["id"]: score_fit(ev, s)["total"] for s in SPONSORS}
    assert got == {"s1": 84, "s2": 81, "s3": 48, "s4": 53, "s5": 86, "s6": 53, "s7": 30, "s8": 46, "s9": 44, "s10": 38}


def test_inr_indian_grouping():
    assert inr(100000) == "₹1,00,000" and inr(2500) == "₹2,500" and inr(999) == "₹999"


def test_event_validation_rejects_bad_input():
    assert client.post("/api/events", json={**EVENT, "category": "Nope"}).status_code == 422
    assert client.post("/api/events", json={**EVENT, "benefits": ["Free yacht"]}).status_code == 422


def test_happy_path_event_fit_outreach_pipeline():
    assert client.post("/api/events", json=EVENT).status_code == 200
    fits = client.get("/api/events/e1/sponsor-fits").json()
    assert fits[0]["sponsorId"] == "s5" and fits[0]["fit_score"] == 86      # sorted high to low
    r = client.post("/api/sponsor-fits/e1:s5/outreach", json={"channel": "Email", "tone": "Friendly"}).json()
    assert r["source"] == "template" and "CodeSprint" in r["email"] and r["risk_flags"]
    assert client.patch("/api/prospects/p1", json={"status": "Contacted"}).status_code == 404
    client.post("/api/prospects", json={"id": "p1", "sponsorId": "s5", "eventId": "e1"})
    assert client.patch("/api/prospects/p1", json={"status": "Contacted"}).json()["status"] == "Contacted"
    assert client.patch("/api/prospects/p1", json={"status": "Whatever"}).status_code == 422


def test_unknown_event_and_sponsor():
    assert client.get("/api/events/missing/sponsor-fits").status_code == 404
    assert client.post("/api/sponsor-fits/e1:zzz/outreach", json={}).status_code == 404


def test_malformed_model_output_is_rejected(monkeypatch):
    monkeypatch.setattr(gemma, "BASE", "http://fake")
    monkeypatch.setattr(gemma, "_chat", lambda *a: '{"subject": "only this"}')
    assert gemma.draft_outreach({}, "Friendly") is None


def test_gemma_output_is_checked_for_invented_numbers(monkeypatch):
    good = {k: "Hello" for k in OutreachDraft.model_fields}
    good["email"] = "Join 300 students. Last year 5000 people attended and we raised 250000."
    monkeypatch.setattr(main.gemma, "BASE", "http://fake")
    monkeypatch.setattr(main.gemma, "_chat", lambda *a: __import__("json").dumps(good))
    r = client.post("/api/sponsor-fits/e1:s5/outreach", json={}).json()
    assert r["source"] == "gemma"
    assert any("5000" in f and "250000" in f for f in r["risk_flags"])
    assert not any("300" in f for f in r["risk_flags"])


def test_extract_needs_model():
    assert client.post("/api/events/extract", json={"text": "x" * 30}).status_code == 503


# ---- certificates and event details ----
def test_certificates_batch_create_list_delete():
    client.post("/api/events", json=EVENT)
    r = client.post("/api/events/e1/certificates", json={
        "names": ["  Riya Sharma ", "", "Aman Verma", "X" * 120], "role": "Winner", "issuer": "  "})
    assert r.status_code == 200
    certs = r.json()
    assert [c["name"] for c in certs][:2] == ["Riya Sharma", "Aman Verma"] and len(certs[2]["name"]) == 80
    assert all(c["role"] == "Winner" and c["issuer"] == "Campus Events Club" for c in certs)
    assert all(c["eventName"] == EVENT["name"] and c["city"] == "Durg" for c in certs)
    nums = [c["number"] for c in certs]
    assert len(set(nums)) == 3 and all(n.startswith("EW-") and len(n) == 9 for n in nums)
    assert len(client.get("/api/events/e1/certificates").json()) >= 3
    assert client.delete(f"/api/certificates/{certs[0]['id']}").status_code == 200
    assert client.delete(f"/api/certificates/{certs[0]['id']}").status_code == 404


def test_certificate_validation():
    assert client.post("/api/events/e1/certificates", json={"names": ["A"], "role": "King"}).status_code == 422
    assert client.post("/api/events/e1/certificates", json={"names": ["   ", ""]}).status_code == 422
    assert client.post("/api/events/e1/certificates", json={"names": []}).status_code == 422
    assert client.post("/api/events/nope/certificates", json={"names": ["A"]}).status_code == 404


def test_certificates_use_event_sent_by_frontend():
    ev = {**EVENT, "id": "e9", "name": "Fresh Event", "city": "Raipur"}
    r = client.post("/api/events/e9/certificates", json={"event": ev, "names": ["Meera"]}).json()
    assert r[0]["eventName"] == "Fresh Event" and r[0]["city"] == "Raipur"


def test_event_summary_and_cascade_delete():
    client.post("/api/events", json={**EVENT, "id": "e2"})
    client.post("/api/prospects", json={"id": "pa", "sponsorId": "s1", "eventId": "e2", "status": "Confirmed"})
    client.post("/api/prospects", json={"id": "pb", "sponsorId": "s4", "eventId": "e2", "status": "Contacted"})
    client.post("/api/events/e2/certificates", json={"names": ["A", "B"]})
    s = client.get("/api/events/e2/summary").json()
    assert (s["sponsors_in_pipeline"], s["confirmed"], s["certificates"]) == (2, 1, 2)
    assert {x["name"] for x in s["sponsor_status"]} == {"Northwind Labs", "Chai & Co. Roasters"}
    assert client.delete("/api/events/e2").status_code == 200
    assert client.get("/api/events/e2/certificates").json() == []
    assert client.get("/api/events/e2/summary").status_code == 404
    assert all(p["eventId"] != "e2" for p in client.get("/api/prospects").json())

from typing import Optional
from pydantic import BaseModel, Field, field_validator

CATEGORIES = ["Technology", "Education", "Cultural", "Sports", "Career", "Social Impact"]
BENEFITS = ["Logo placement", "Booth space", "Social media promotion",
            "Speaking opportunities", "Workshops", "Recruitment access"]
ROLES = ["Participant", "Winner", "Runner-up", "Volunteer", "Speaker", "Organiser"]
STATUSES = ["Researching", "Ready to Contact", "Contacted", "Replied",
            "Negotiating", "Confirmed", "Declined"]


class Event(BaseModel):
    id: Optional[str] = None
    name: str = Field(min_length=1)
    category: str
    description: str = Field(min_length=20)
    audience: str = Field(min_length=1)
    attendees: int = Field(gt=0)
    city: str = Field(min_length=1)
    date: str = ""
    target: int = Field(gt=0)
    benefits: list[str] = Field(min_length=1)

    @field_validator("category")
    @classmethod
    def _cat(cls, v):
        if v not in CATEGORIES:
            raise ValueError(f"category must be one of {CATEGORIES}")
        return v

    @field_validator("benefits")
    @classmethod
    def _ben(cls, v):
        bad = [b for b in v if b not in BENEFITS]
        if bad:
            raise ValueError(f"unknown benefits: {bad}")
        return v


class Package(BaseModel):
    id: Optional[str] = None
    name: str
    range: list[int] = Field(min_length=2, max_length=2)
    benefits: list[str] = []


class OutreachRequest(BaseModel):
    event: Optional[Event] = None      # sent by the frontend so the API is stateless-friendly
    package: Optional[Package] = None
    channel: str = "Email"
    tone: str = "Professional"


class OutreachDraft(BaseModel):
    """Shape Gemma must return. Anything else is rejected."""
    subject: str
    email: str
    linkedin: str
    whatsapp: str
    follow1: str
    follow2: str


class Prospect(BaseModel):
    id: str
    sponsorId: Optional[str] = None
    eventId: Optional[str] = None
    status: str = "Researching"
    lastContact: str = ""
    nextAction: str = ""
    followUp: str = ""
    notes: str = ""

    @field_validator("status")
    @classmethod
    def _st(cls, v):
        if v not in STATUSES:
            raise ValueError(f"status must be one of {STATUSES}")
        return v


class ProspectPatch(BaseModel):
    status: Optional[str] = None
    lastContact: Optional[str] = None
    nextAction: Optional[str] = None
    followUp: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("status")
    @classmethod
    def _st(cls, v):
        if v is not None and v not in STATUSES:
            raise ValueError(f"status must be one of {STATUSES}")
        return v


class BriefIn(BaseModel):
    text: str = Field(min_length=20, max_length=6000)


class CertBatch(BaseModel):
    """Create one certificate per student name for an event."""
    event: Optional[Event] = None
    names: list[str] = Field(min_length=1, max_length=500)
    role: str = "Participant"
    issuer: str = "Campus Events Club"

    @field_validator("names")
    @classmethod
    def _names(cls, v):
        clean = [n.strip()[:80] for n in v if n and n.strip()]
        if not clean:
            raise ValueError("enter at least one student name")
        return clean

    @field_validator("role")
    @classmethod
    def _role(cls, v):
        if v not in ROLES:
            raise ValueError(f"role must be one of {ROLES}")
        return v

    @field_validator("issuer")
    @classmethod
    def _issuer(cls, v):
        return v.strip()[:80] or "Campus Events Club"


class Certificate(BaseModel):
    id: str
    eventId: str
    name: str = Field(min_length=1, max_length=80)
    role: str = "Participant"
    issuer: str = "Campus Events Club"
    eventName: str = ""
    category: str = ""
    date: str = ""
    city: str = ""
    number: str = ""
    issued: str = ""

    @field_validator("role")
    @classmethod
    def _role(cls, v):
        if v not in ROLES:
            raise ValueError(f"role must be one of {ROLES}")
        return v

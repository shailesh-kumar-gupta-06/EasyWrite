"""Template drafts (no AI). Used when Gemma is not configured or its output is rejected."""
from scoring import inr

TONES = {
    "Professional": ("Dear Partnerships Team,", "Thank you for your time.", "Best regards,"),
    "Friendly": ("Hi there,", "Thanks so much for reading!", "Warm wishes,"),
    "Persuasive": ("Hello,", "We would love to build something memorable together.", "With appreciation,"),
}


def pkg_text(p) -> str:
    return f"{p.name} ({inr(p.range[0])}–{inr(p.range[1])}, demo estimate)" if p else "a sponsorship package"


def template_outreach(e, s: dict, pkg, tone: str) -> dict:
    g = TONES.get(tone, TONES["Professional"])
    benefits = (pkg.benefits if pkg and pkg.benefits else e.benefits)
    ben = "\n".join("• " + x for x in benefits) or "• Details to be discussed"
    val = (f"We noticed {s['name']} works in {s['industry'].lower()}. Our event may be relevant to "
           f"your stated focus on {' and '.join(s['goals']).lower()}.")
    when = f" on {e.date}" if e.date else ""
    where = f" in {e.city}" if e.city else ""
    ask = f"We would like to invite {s['name']} to consider {pkg_text(pkg)}."
    return {
        "subject": f"Partnership opportunity: {e.name}",
        "email": (f"{g[0]}\n\nWe are organising {e.name}, a {e.category.lower()} event{where}{when}"
                  f" with an expected {e.attendees} attendees. {e.description}\n\n{val}\n\n{ask}\n\n"
                  f"Benefits we can offer:\n{ben}\n\nWould you be open to a short conversation or "
                  f"reviewing a one-page proposal? {g[1]}\n\n{g[2]}\n[Your name]\n[Your club]"),
        "linkedin": (f"Hello! I'm helping organise {e.name}{where}. We're exploring partners and thought "
                     f"{s['name']} might be a relevant fit. Could I share a short sponsorship overview?"),
        "whatsapp": (f"Hi! This is [your name] from [your club]. We're organising {e.name}{when}. "
                     f"Would you be open to hearing about sponsorship options?"),
        "follow1": (f"Subject: Following up on {e.name}\n\n{g[0]}\n\nI wanted to follow up on my earlier note "
                    f"about {e.name}. Happy to share more details or adjust {pkg_text(pkg)} to suit "
                    f"{s['name']}.\n\n{g[2]}\n[Your name]"),
        "follow2": (f"Subject: Final note on {e.name}\n\n{g[0]}\n\nThis is a final follow-up about {e.name}. "
                    f"If the timing isn't right, no problem at all, and thank you for considering it.\n\n"
                    f"{g[2]}\n[Your name]"),
    }

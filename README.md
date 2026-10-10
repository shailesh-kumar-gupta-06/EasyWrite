# EasyWrite.AI

A sponsorship helper for campus clubs, built on Gemma 4. You give it an event brief, it tells you which sponsors to approach first, what to offer them, and drafts the outreach. A simple board keeps track of where each sponsor stands.

Made for the Build for Your Campus hackathon. Open source under the MIT license.

## The problem

Most clubs have an event idea but burn a lot of time on sponsorship. Who is a realistic sponsor? Why would they care? What do we offer in return? Then there is the email itself, the follow-ups, and remembering who replied. A generic "please sponsor us" mail rarely gets a response because it never explains what the sponsor gets.

## What it does

1. **Event profile.** Enter your event details (name, type, audience, funding target, what you can offer). Gemma 4 turns it into a clean, structured profile you can review.
2. **Sponsor fit.** Sponsors from a small curated list are scored against your event. The score comes from visible factors, and Gemma 4 explains the result in plain language and points out what information is missing.
3. **Package suggestion.** Based on what the sponsor likely wants (hiring, developer adoption, brand awareness, local reach), the app suggests a tier and a set of benefits.
4. **Outreach drafts.** Editable cold email, LinkedIn/WhatsApp intro, and two follow-ups, using only the facts you have confirmed.
5. **Pipeline.** Track each sponsor through: Researching, Ready to contact, Contacted, Replied, Negotiating, Confirmed or Declined.

The app never sends anything. You review, edit, and send messages yourself.

## How scoring works

```text
fit score = audience alignment       (35)
          + event / theme alignment  (25)
          + sponsor goal match       (20)
          + geography / relationship (10)
          + budget feasibility       (10)
```

The weights live in one place and can be changed. This is a heuristic to help you prioritise, not a prediction that a sponsor will say yes.

## Where Gemma 4 is used

- Extracting structured facts from the event brief
- Explaining why a sponsor fits, based on the score components
- Writing the sponsor-specific value proposition
- Drafting emails and follow-ups
- Flagging claims that are not backed by the supplied facts

The model sits behind a small adapter (`backend/gemma.py`), so you can run it locally or point it at a hosted endpoint by changing environment variables. Model output is validated against a schema before it reaches the UI.

## Tech stack

| Part | Choice |
| --- | --- |
| Frontend | HTML, CSS, JavaScript |
| Backend | FastAPI (Python) |
| Validation | Pydantic |
| Storage | SQLite |
| Model | Gemma 4 through an adapter |

## Project structure

```text
campus-sponsor-ai/
├── backend/
│   ├── main.py            # API routes
│   ├── scoring.py         # fit score logic
│   ├── gemma.py           # Gemma 4 adapter
│   ├── models.py          # Pydantic schemas
│   ├── db.py              # SQLite helpers
│   └── data/sponsors.json # sample sponsors
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── skills/campus-sponsor/SKILL.md
├── .env.example
├── LICENSE
└── README.md
```

## Getting started

You need Python 3.10+ and a running Gemma 4 endpoint (for example through Ollama or any compatible server).

```bash
git clone https://github.com/<your-username>/campus-sponsor-ai.git
cd campus-sponsor-ai

python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt

cp .env.example .env
```

Edit `.env`:

```bash
GEMMA_BASE_URL=http://localhost:11434
GEMMA_MODEL=gemma-4
GEMMA_API_KEY=
DATABASE_URL=sqlite:///./data/campus-sponsor.db
```

Start the backend:

```bash
cd backend
uvicorn main:app --reload
```

Then open `frontend/index.html` in your browser, or serve it with `python -m http.server 3000` from the `frontend` folder.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/events` | Save an event brief |
| GET | `/api/events/{id}/sponsor-fits` | Ranked sponsors with reasons |
| POST | `/api/sponsor-fits/{id}/outreach` | Generate email and follow-up drafts |
| PATCH | `/api/prospects/{id}` | Update status, owner, next action |

## Sample data

Everything in `backend/data/sponsors.json` and the example event (HackStorm 2026) is made up for demo purposes. Do not add real contact lists or private budgets to the repository.

## Limitations

- The fit score is a guide, not a guarantee.
- Output quality depends on how accurate your event details are. Always check numbers and claims before sending.
- Sponsor data is hand-written. There is no live research, contact lookup, or scraping.
- Pricing tiers are starting points. Adjust them to what makes sense for your college and city.
- No authentication yet, so keep it on your local machine.

## Roadmap

- Read event details from a poster or PDF
- Export a proposal as PDF
- Counteroffer comparison
- Multilingual drafts
- Team accounts and reminders

## Privacy

Do not send student lists, personal contact details, or confidential budgets to a public model endpoint unless you have permission. Keep API keys in `.env` and out of Git.

## Contributing

Open an issue before starting anything big. For pull requests, keep the change focused, and if you touch prompts, schemas, or scoring weights, update the tests and docs with it.

## License

MIT. See [LICENSE](LICENSE). The Gemma 4 model and any third-party dependencies have their own terms, which you should follow.

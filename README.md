# Findy – Israeli Tech Job Search

Minimal job search app: scrape tech jobs (Greenhouse, Lever, Workday, Comeet), filter by Israel/seniority/title, optional resume matching. One Flask backend, static frontend.

## Structure

```
jobmatch-bot/
├── backend/
│   ├── app.py            # Flask app (routes, serve frontend)
│   ├── config.py         # Configuration constants
│   ├── database.py       # DB connection and schema
│   ├── jobs_store.py     # Job persistence and querying
│   ├── resume_parser.py  # PDF text extraction
│   ├── seniority.py      # Seniority detection
│   ├── job_scraper.py    # Entry: scrape_all_jobs()
│   ├── job_matcher.py    # filter_jobs(), rank_jobs()
│   └── scrapers/         # Greenhouse, Lever, Workday, Comeet
├── frontend/
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── data/                 # jobs.db (created at runtime)
├── requirements.txt
├── .env.example
├── run.py
└── README.md
```

## Run

```bash
# From project root
pip install -r requirements.txt
python run.py
```

Open **http://localhost:5000**. Optional: upload a PDF resume, set title/seniority, then Search. Use `/refresh` or `/api/jobs/refresh` to rescrape and update the DB.

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Main UI |
| `/api/health` | GET | Health check |
| `/api/resume/upload` | POST | Upload PDF, get extracted text |
| `/api/jobs/search` | GET/POST | Search (scrape + filter + optional rank by resume) |
| `/api/jobs/stats` | GET | Job count (last 7 days) |
| `/api/jobs/refresh` | GET/POST | Scrape all sources and upsert to DB |

## Config

Edit `backend/config.py`: `GREENHOUSE_TOKENS`, `LEVER_SLUGS`, `WORKDAY_BOARDS`, `COMEET_*`, `DEFAULT_DAYS_BACK`, `USE_EMBEDDING_MATCHER`.

## Removed in refactor

- **backend/app** (FastAPI)
- **backend/flask** (legacy Flask; logic moved to backend/app + config + database + jobs_store + resume_parser + seniority + job_matcher + scrapers)
- **backend/core**, **backend/job**, **backend/resume**, **backend/seniority**, **storage** (split into config, database, jobs_store, resume_parser, seniority)
- **scripts/** (manual scan scripts)
- **Next.js frontend** (replaced by static HTML/JS/CSS)



![Findy](assets/findy-logo.png)

Findy is a job discovery application that aggregates tech job postings from multiple company job boards and helps candidates quickly find relevant opportunities in Israel.

The system collects jobs from common ATS platforms (Greenhouse, Lever, Workday, Comeet), stores them locally, and allows filtering by title and seniority. Users can optionally upload a resume to rank jobs based on relevance.

## Features

- **Aggregates job postings from multiple ATS platforms**
  - Greenhouse
  - Lever
  - Workday
  - Comeet

- **Job filtering**
  - Title filtering
  - Seniority detection
  - Israel-based opportunities

- **Resume parsing**
  - Upload a PDF resume
  - Extract text from the document
  - Rank jobs based on resume relevance

## Architecture

```
Findy
│
├── backend
│   ├── app.py
│   ├── config.py
│   ├── database.py
│   ├── jobs_store.py
│   ├── job_scraper.py
│   ├── job_matcher.py
│   ├── resume_parser.py
│   ├── seniority.py
│   └── scrapers
│
├── frontend
│   ├── index.html
│   ├── app.js
│   └── styles.css
│
├── data
│   └── jobs.db
│
├── run.py
├── requirements.txt
└── README.md
```

The backend handles job scraping, filtering, and ranking logic, while the frontend provides the user interface for searching jobs and uploading resumes.

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Backend** | Python, Flask, SQLite |
| **Resume parsing** | pdfplumber |
| **Frontend** | HTML, JavaScript, CSS |

## Running the Project

**Install dependencies:**

```bash
pip install -r requirements.txt
```

**Run the application:**

```bash
python run.py
```


## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Web interface |
| `/api/health` | GET | Service health check |
| `/api/resume/upload` | POST | Upload resume and extract text |
| `/api/jobs/search` | GET / POST | Search jobs |
| `/api/jobs/stats` | GET | Job statistics |
| `/api/jobs/refresh` | GET / POST | Refresh job database |


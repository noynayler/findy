

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


## CI/CD

### CI (`.github/workflows/ci.yml`)

- **Triggers:** Every push and every pull request (all branches).
- **Steps:** Checkout → install dependencies → run pytest → optional Ruff lint → build Docker image for validation only.
- **Does not:** Push images or deploy.

Run tests locally:

```bash
pip install -r requirements.txt pytest
PYTHONPATH=. pytest
```

### CD (`.github/workflows/cd.yml`)

- **Triggers:** Push to `main`, or push of a tag matching `v*` (e.g. `v1.0.0`).
- **Concurrency:** One deployment at a time (no overlapping deploys).

**On push to main:**

- Build and push: `ghcr.io/<owner>/findy:main`, `ghcr.io/<owner>/findy:latest`.
- Deploy: `kubectl apply -f k8s/` → `kubectl set image deployment/findy findy=ghcr.io/<owner>/findy:main` → `kubectl rollout status deployment/findy`.

**On tag push (e.g. `v1.0.0`):**

- Build and push: `ghcr.io/<owner>/findy:v1.0.0`, `ghcr.io/<owner>/findy:latest`.
- Deploy: same steps, with image `ghcr.io/<owner>/findy:v1.0.0`.

### Creating a release

```bash
git tag v1.0.0
git push origin v1.0.0
```

CD builds the image, pushes `v1.0.0` and `latest` to GHCR, and deploys to Kubernetes using that image.

### Secrets

- **GHCR:** Uses `GITHUB_TOKEN`; no extra secret.
- **Kubernetes:** Add repository secret `KUBE_CONFIG_DATA` = base64-encoded kubeconfig.  
  Linux/macOS: `cat ~/.kube/config | base64 -w0`.  
  Windows (PowerShell): `[Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:USERPROFILE\.kube\config"))`.  
  Without it, the deploy step fails; build-and-push still succeeds.  

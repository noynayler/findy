<p align="center">
  <img src="assets/findy-logo.png" alt="Findy" width="160" />
</p>

# 🚀 AI-Powered Career Matcher

**[Live Demo 🌐](YOUR_RAILWAY_URL_HERE)**

Full-stack app that aggregates **Israel-focused tech roles** from multiple ATS sources, scores **CV ↔ job fit** with **Gemini**, and persists **analyzed matches** in **PostgreSQL** (e.g. `job_match_analyses` by CV hash + job URL). **Job search** reads **`public.jobs` in Supabase** (no live scrape on each search). Listings are filled by scraping + upsert (**`run_daily_scrape.py`** / Render cron in [`render.yaml`](render.yaml), or **`POST /api/jobs/refresh`** for manual HTTP refresh) — schedule a **daily job** (see below) so `public.jobs` stays current.

## Screenshot

Job board with **AI match insight**, score, and actions (**Analyze Match**, **Adjust My CV**, **Apply**):

![Findy UI — job cards with AI match insight](assets/screenshot.png)

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS.
- **Backend:** Python Flask, Gunicorn.
- **Database:** PostgreSQL.
- **AI:** Gemini 2.5 Flash API.

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

 **AI-Driven Match Intelligence**
  - **Semantic Ranking:** Beyond keyword matching—uses **Gemini 2.5 Flash** to understand context and experience alignment.
  - **Actionable Insights:** Generates a "Fit Score" (0-100) and specific "Adjust My CV" tips for each position.
  - **Read-Through Caching:** Engineered a logic that prioritizes PostgreSQL lookups over AI API calls to minimize latency and operational costs.
  - **Structured Data:** LLM-powered extraction that converts unstructured job descriptions into a normalized JSON format.

## System Architecture

```mermaid
flowchart LR
    User("👤 User")
    DB[("🗄️ PostgreSQL")]
    Cron["⏰ Daily cron\nPython or HTTP"]
    Scrape["🌐 ATS scrape"]
    AI["🤖 Gemini"]
    Logic{"❓\n Cache"}

    User -->|Upload CV| DB
    Cron --> Scrape
    Scrape -->|upsert jobs| DB
    User -->|Search jobs| DB
    DB -->|filter rank| User
    User -->|Analyze match| Logic
    Logic -->|Miss| AI
    AI -->|Persist analysis| DB
    Logic -->|Hit| DB

    style DB fill:#336791,color:#fff
    style AI fill:#4285f4,color:#fff
    style Scrape fill:#f96,color:#fff
```

### Database and job data

- Apply `postgresql/schema.sql` (or incremental files under `postgresql/migrations/`) in the Supabase SQL editor.
- **`public.jobs`**: populated by scraping + upsert (see **Daily scrape** below). **Search** reads from here via Flask; if the table is empty, run a scrape first.

### Daily scrape (cron)

**Recommended (Render):** Use the **Python cron** in [`render.yaml`](render.yaml) (`findy-daily-scrape`). It runs [`run_daily_scrape.py`](run_daily_scrape.py) on a schedule — same scrape + upsert as `POST /api/jobs/refresh`, without HTTP. Set **`SUPABASE_URL`** and **`SUPABASE_ANON_KEY`** on the cron service (mirror the web service; optional: **`VITE_SUPABASE_URL`** + **`VITE_SUPABASE_ANON_KEY`**). Persistence uses **Supabase PostgREST**, not `DATABASE_URL`.

**Local / CI check:** `PYTHONPATH=. python run_daily_scrape.py`

**Optional — HTTP refresh** (manual or external scheduler):

```bash
# Example: 06:00 UTC daily; requires JOBS_REFRESH_SECRET when set on the server
0 6 * * * curl -fsS -X POST "https://your-host/api/jobs/refresh" -H "Authorization: Bearer $JOBS_REFRESH_SECRET"
```

If **`JOBS_REFRESH_SECRET`** is **unset**, refresh is open (fine for local dev). If **set**, use **`Authorization: Bearer <secret>`** or **`?token=<secret>`**.

**Local:** `curl -X POST http://localhost:5000/api/jobs/refresh`

## CI/CD

End-to-end flow is **Docker-first**: GitHub Actions validates every change; **GitHub Container Registry (GHCR)** stores **immutable, versioned images**; **Render** runs production using a **push-to-deploy** model with **rolling updates** for zero-downtime cutovers.


```mermaid
graph LR
    %% Events
    Push[Push / PR to GitHub] --> CI

    %% CI Stage
    subgraph CI [Continuous Integration]
        direction TB
        Lint[Ruff: Backend Linting]
        Test[Pytest: Unit Testing]
        Type[TSC: Frontend Type-Check]
        DockerCheck[Docker: Build Validation]
        
        Lint & Test & Type & DockerCheck --> CI_Success{All Pass?}
    end

    %% CD Stage
    CI_Success -- "On Main / Tag" --> CD
    
    subgraph CD [Continuous Delivery]
        direction TB
        Build[Docker Buildx: Multi-stage Build]
        PushGHCR[Push to GHCR: latest / sha-tag]
        Deploy[Render: Rolling Update]
        
        Build --> PushGHCR --> Deploy
    end

    %% Styling
    style Push fill:#f8f9fa,stroke:#333
    style CI fill:#e7f3ff,stroke:#007bff,stroke-width:2px
    style CD fill:#f0fff4,stroke:#28a745,stroke-width:2px
    style Deploy fill:#3ecf8e,stroke:#333,color:#fff
    style PushGHCR fill:#24292e,stroke:#333,color:#fff

```

### 🧪 CI — Continuous Integration (`.github/workflows/ci.yml`)

Triggered on **every push** and **pull request** across all branches to ensure stability:


| Stage | Path / Context | Tool & Command |
| :--- | :--- | :--- |
| **Lint** | `backend/` | **Ruff** (Static analysis & formatting) |
| **Test** | `tests/` | **Pytest** (Unit & Integration tests) |
| **Type-check** | `frontend/src/` | **TypeScript** (`tsc --noEmit`) |
| **Frontend build** | `frontend/` | **Vite** production build verification |
| **Docker** | `./Dockerfile` | **Buildx** multi-stage validation |

### 🚀 CD — Continuous Delivery (`.github/workflows/cd.yml`)

Triggered only on **pushes to `main`** or **Git tags** (`v*`):


| Step | Action | Description |
| :--- | :--- | :--- |
| **Build & Push** | `Dockerfile` | Multi-stage production build pushed to **GHCR**; passes **`VITE_*`** from repo **Secrets** as Docker build-args (Gemini + Supabase for the browser bundle) |
| **Versioning** | `ghcr.io/` | Tags: **`latest`**, **`sha-<commit>`**, and **SemVer tags** |
| **Deploy** | **Render Hook** | Triggers an automated **Zero-Downtime Rolling Update** |








---


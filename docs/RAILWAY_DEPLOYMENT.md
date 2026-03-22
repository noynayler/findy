# Railway deployment (single Docker image)

This repo ships one container: **Vite `frontend/dist`** is copied into the image and served by **Flask**; **Gunicorn** listens on **`0.0.0.0:$PORT`**.

## Layout (verified paths)

| Layer | Path |
|--------|------|
| Frontend (React + Vite + TS) | `frontend/` → `npm run build` → `frontend/dist/` |
| Backend (Flask) | `backend/app.py` (`app`), `backend/database.py`, `backend/jobs_store.py`, … |
| Container definition | Root `Dockerfile` (multi-stage) |
| Python deps | `requirements.txt` |
| Node deps | `frontend/package.json`, `frontend/package-lock.json` |
| WSGI (optional alias) | `wsgi.py` → `gunicorn wsgi:app` |

There are **no** duplicate `.js` sources under `frontend/src/` (only `tailwind.config.js` / `postcss.config.js` tooling). App logic lives under `frontend/src/components`, `frontend/src/services`, `frontend/src/types`, `frontend/src/utils`.

## Environment variables (Railway dashboard)

Set these in the Railway service **Variables** (and **Docker Build Arguments** where noted).

### Required for the container to listen correctly

| Variable | Notes |
|----------|--------|
| `PORT` | **Injected by Railway** — do not hardcode. Gunicorn uses `0.0.0.0:${PORT}`. |

### Supabase (Flask job cache at runtime)

The API uses **`supabase-py`** (HTTPS → PostgREST), not a direct Postgres driver. **Apply `postgresql/schema.sql` once** in the Supabase SQL editor.

| Variable | Required? | Notes |
|----------|-----------|--------|
| `SUPABASE_URL` | **Required for job DB** | Project URL, e.g. `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | **Required for job DB** | Anon/public key (same RLS as the browser) |

Alternatively Flask will read **`VITE_SUPABASE_URL`** / **`VITE_SUPABASE_ANON_KEY`** if set in the **runtime** environment (root `.env` or platform variables). **Docker:** Stage 2 does not inherit Vite build args—set **`SUPABASE_*`** (or **`VITE_*`**) on the running container.

### Runtime / ops

| Variable | Required? | Notes |
|----------|-----------|--------|
| `FLASK_DEBUG` | Optional | Use `false` or `0` in production. Default in `run.py` is permissive for local dev. |

### Frontend (baked at **Docker build** time)

Vite reads **`VITE_*`** when `npm run build` runs. For Docker, pass them as **build args** in Railway (or your build pipeline), not only as runtime variables.

| Build arg / env at build | Required? | Notes |
|--------------------------|-----------|--------|
| `VITE_GEMINI_API_KEY` | Optional | Client-side Gemini; omit if you only use cached match rows from PostgreSQL. |
| `VITE_SUPABASE_URL` | Optional | PostgREST / PostgreSQL REST base URL (see README). |
| `VITE_SUPABASE_ANON_KEY` | Optional | PostgREST publishable / anon key (RLS still applies). |

**Railway:** configure these under the service’s **Docker** settings as **Build Arguments**, matching the `ARG` names in the root `Dockerfile`.

### Browser bundle (build-time `VITE_*`)

These are compiled into the static JS bundle when `npm run build` runs:

- `@google/generative-ai` (npm) — Gemini in the browser
- `@supabase/supabase-js` — Supabase client in the browser

Flask **also** can use the same URL/key at **runtime** if you expose `VITE_SUPABASE_*` or `SUPABASE_*` to the Python process (see above).

### Scraper / config (Python, optional)

Any variables used by `backend/config.py` or scrapers (e.g. Comeet limits) can be added later via env + `os.environ` if you extend `config.py`.

## Health check

Use HTTP GET **`/api/health`** (JSON).

## Commands reference

- **Production (Docker / Railway):** `gunicorn ... backend.app:app` (see `Dockerfile` `CMD`).
- **Local dev:** `python run.py` (uses `PORT` if set).

## Schema

- Create tables and RLS in **Supabase → SQL** using **`postgresql/schema.sql`** (and migrations under `postgresql/migrations/` if you use them). The Flask app **does not** apply DDL on boot.

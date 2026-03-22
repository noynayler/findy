# =============================================================================
# Single-container image: Vite production build + Flask API + Gunicorn (Railway)
# =============================================================================
# Frontend:  frontend/          → npm run build → frontend/dist
# Backend:   backend/app.py     → Flask app instance `app`
# Process:   gunicorn binds 0.0.0.0:$PORT (Railway sets PORT)
# =============================================================================

# --- Stage 1: Node — build static assets ------------------------------------
FROM node:20-bookworm-slim AS frontend-build

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./

# Vite inlines VITE_* at build time; pass as Docker build-args in Railway if needed.
ARG VITE_GEMINI_API_KEY=
ENV VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY
# PostgREST / PostgreSQL REST (optional UI persistence; names kept for Vite compatibility)
ARG VITE_SUPABASE_URL=
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY=
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

# --- Stage 2: Python — API + copy dist into image ---------------------------
FROM python:3.11-slim-bookworm

WORKDIR /app

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
# Flask uses supabase-py at runtime — set SUPABASE_URL + SUPABASE_ANON_KEY (or VITE_*) on the container.

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Application source (excludes large dirs via .dockerignore)
COPY . .

# Map Vite output → path expected by backend/app.py (FRONTEND_DIST)
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

EXPOSE 5000

# Railway injects PORT; default 5000 for local docker run
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-5000} --workers 2 --threads 4 --timeout 120 backend.app:app"]

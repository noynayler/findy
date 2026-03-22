"""Supabase (PostgREST over HTTPS): same public tables as postgresql/schema.sql — no direct Postgres."""

from __future__ import annotations

import os
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent

_supabase_client = None
_supabase_verified = False


class DatabaseConfigurationError(RuntimeError):
    """Raised when Supabase URL/key is missing or the API is unreachable."""


def _load_dotenv_if_available() -> None:
    """Load root .env, then frontend/.env (fills VITE_* for backend without duplicating keys)."""
    try:
        from dotenv import load_dotenv

        load_dotenv(ROOT / ".env")
        # VITE_SUPABASE_* often live only in frontend/.env; do not override root vars
        load_dotenv(ROOT / "frontend" / ".env", override=False)
    except ImportError:
        pass


def _supabase_url() -> str:
    _load_dotenv_if_available()
    url = (
        os.environ.get("SUPABASE_URL", "").strip()
        or os.environ.get("VITE_SUPABASE_URL", "").strip()
    ).strip()
    return url.rstrip("/")


def _supabase_anon_key() -> str:
    _load_dotenv_if_available()
    return (
        os.environ.get("SUPABASE_ANON_KEY", "").strip()
        or os.environ.get("VITE_SUPABASE_ANON_KEY", "").strip()
    ).strip()


_load_dotenv_if_available()


def get_supabase():
    """
    Lazy singleton Supabase client (HTTP — avoids direct Postgres / DNS to db.*).

    Env (first match wins for URL/key):
    - SUPABASE_URL or VITE_SUPABASE_URL
    - SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY
    """
    global _supabase_client

    if _supabase_client is not None:
        return _supabase_client

    try:
        from supabase import create_client
    except ImportError as e:
        raise DatabaseConfigurationError(
            "Install the Supabase SDK: pip install supabase",
        ) from e

    url = _supabase_url()
    key = _supabase_anon_key()
    if not url or not key:
        raise DatabaseConfigurationError(
            "Set SUPABASE_URL and SUPABASE_ANON_KEY (or VITE_SUPABASE_URL and "
            "VITE_SUPABASE_ANON_KEY) in the project root .env and/or frontend/.env.",
        )

    _supabase_client = create_client(url, key)
    return _supabase_client


def init_db() -> None:
    """
    Smoke-check Supabase + `public.jobs` (no DDL: apply postgresql/schema.sql in the SQL editor).

    RLS policies from your schema must allow anon read on `jobs` for this to succeed.
    """
    global _supabase_verified
    if _supabase_verified:
        return
    sb = get_supabase()
    try:
        sb.table("jobs").select("id").limit(1).execute()
    except Exception as e:
        raise DatabaseConfigurationError(
            f"Supabase reachable but `jobs` check failed: {e}",
        ) from e
    _supabase_verified = True


# Backwards compatibility — direct Postgres removed
def get_connection():
    raise DatabaseConfigurationError(
        "Direct Postgres (get_connection) is removed. Use get_supabase() and table APIs.",
    )

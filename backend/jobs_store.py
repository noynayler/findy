"""Job persistence and querying (Supabase public.jobs via PostgREST)."""

import json
import re
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from postgrest.types import CountMethod

from backend import config
from backend import database


def _parse_date_posted(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            s = value.replace("Z", "+00:00")
            dt = datetime.fromisoformat(s)
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def _iso_utc(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _raw_json_payload(job: Dict) -> Dict:
    """Ensure JSON-serializable dict for jsonb (datetimes etc.)."""
    return json.loads(json.dumps(job, default=str, ensure_ascii=False))


def is_in_israel(job: Dict) -> bool:
    """Whether job is in Israel or allows Israel remote."""
    location = (job.get("location") or "").lower()
    title = (job.get("title") or "").lower()
    description = (job.get("description") or "").lower()
    company = (job.get("company") or "").lower()
    source = (job.get("source") or "").lower()
    text = f"{location} {title} {description} {company}"
    locked = [
        r"\bus only\b",
        r"u\.s\. only",
        r"united states only",
        r"\bcanada only\b",
        r"\buk only\b",
        r"u\.k\. only",
        r"must be located in (the )?(us|united states|canada|uk)\b",
        r"based in (the )?(us|united states|canada|uk)\b",
        r"remote\s*-\s*us\b",
        r"remote\s*-\s*americas\b",
    ]
    for pattern in locked:
        if re.search(pattern, text, re.IGNORECASE):
            if not any(
                k in text for k in ["israel", "tel aviv", "jerusalem", "herzliya"]
            ):
                return False
    for kw in config.ISRAEL_LOCATION_KEYWORDS:
        if kw in text:
            return True
    for kw in config.ISRAEL_REMOTE_KEYWORDS:
        if kw in text:
            return True
    if not location or location in ["remote", "anywhere", ""]:
        if source in ["greenhouse", "lever"]:
            return True
    cities = [
        "tel aviv",
        "tel-aviv",
        "jerusalem",
        "haifa",
        "herzliya",
        "ramat gan",
        "beer sheva",
        "netanya",
        "petah tikva",
        "rishon lezion",
        "rehovot",
        "modiin",
        "raanana",
    ]
    for city in cities:
        if city in location:
            return True
    if (not location or "remote" in location) and source in ["greenhouse", "lever"]:
        return True
    return False


_UPSERT_BATCH = 250


def upsert_jobs(normalized_jobs: List[Dict]) -> None:
    if not normalized_jobs:
        return
    now_iso = _iso_utc(datetime.now(timezone.utc))
    rows: List[Dict[str, Any]] = []

    for job in normalized_jobs:
        company = (job.get("company") or "").strip()
        title = (job.get("title") or "").strip()
        url = (job.get("url") or "").strip()
        if not url and not (company or title):
            continue
        if not url:
            continue
        date_posted = _parse_date_posted(job.get("date_posted"))
        rows.append(
            {
                "title": title,
                "company": company,
                "location": job.get("location") or "",
                "url": url,
                "source": job.get("source") or "",
                "date_posted": _iso_utc(date_posted),
                "description": (job.get("description") or "")[:65535],
                "raw_json": _raw_json_payload(job),
                "last_seen_at": now_iso,
            }
        )

    if not rows:
        return

    database.init_db()
    sb = database.get_supabase()
    for i in range(0, len(rows), _UPSERT_BATCH):
        batch = rows[i : i + _UPSERT_BATCH]
        sb.table("jobs").upsert(batch, on_conflict="url").execute()


def query_jobs(days: int = 7, israel_only: bool = True) -> List[Dict]:
    database.init_db()
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    cutoff_iso = _iso_utc(cutoff)
    sb = database.get_supabase()
    sel = "raw_json,date_posted"

    r_ge = (
        sb.table("jobs")
        .select(sel)
        .gte("date_posted", cutoff_iso)
        .order("date_posted", desc=True)
        .execute()
    )
    r_null = sb.table("jobs").select(sel).is_("date_posted", "null").execute()

    merged = (r_ge.data or []) + (r_null.data or [])

    jobs: List[Dict] = []
    for row in merged:
        raw_json_val = row.get("raw_json")
        try:
            if isinstance(raw_json_val, dict):
                job = raw_json_val
            else:
                job = json.loads(raw_json_val) if raw_json_val is not None else {}
            if israel_only and not is_in_israel(job):
                continue
            jobs.append(job)
        except (json.JSONDecodeError, TypeError):
            continue
    return jobs


def count_jobs() -> int:
    database.init_db()
    sb = database.get_supabase()
    res = (
        sb.table("jobs")
        .select("id", count=CountMethod.exact, head=True)
        .execute()
    )
    return int(res.count) if res.count is not None else 0

"""Job persistence and querying."""

import hashlib
import json
import re
from datetime import datetime, timezone, timedelta
from typing import List, Dict

from backend import config
from backend import database


def build_job_id(company: str, title: str, url: str) -> str:
    raw = f"{company}|{title}|{url}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def is_in_israel(job: Dict) -> bool:
    """Whether job is in Israel or allows Israel remote."""
    location = (job.get("location") or "").lower()
    title = (job.get("title") or "").lower()
    description = (job.get("description") or "").lower()
    company = (job.get("company") or "").lower()
    source = (job.get("source") or "").lower()
    text = f"{location} {title} {description} {company}"
    locked = [
        r"\bus only\b", r"u\.s\. only", r"united states only",
        r"\bcanada only\b", r"\buk only\b", r"u\.k\. only",
        r"must be located in (the )?(us|united states|canada|uk)\b",
        r"based in (the )?(us|united states|canada|uk)\b",
        r"remote\s*-\s*us\b", r"remote\s*-\s*americas\b",
    ]
    for pattern in locked:
        if re.search(pattern, text, re.IGNORECASE):
            if not any(k in text for k in ["israel", "tel aviv", "jerusalem", "herzliya"]):
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
    cities = ["tel aviv", "tel-aviv", "jerusalem", "haifa", "herzliya", "ramat gan", "beer sheva", "netanya", "petah tikva", "rishon lezion", "rehovot", "modiin", "raanana"]
    for city in cities:
        if city in location:
            return True
    if (not location or "remote" in location) and source in ["greenhouse", "lever"]:
        return True
    return False


def upsert_jobs(normalized_jobs: List[Dict]) -> None:
    if not normalized_jobs:
        return
    database.init_db()
    now = datetime.now(timezone.utc).isoformat()
    conn = database.get_connection()
    try:
        for job in normalized_jobs:
            company = (job.get("company") or "").strip()
            title = (job.get("title") or "").strip()
            url = (job.get("url") or "").strip()
            if not url and not (company or title):
                continue
            job_id = build_job_id(company, title, url)
            date_posted = job.get("date_posted")
            if hasattr(date_posted, "isoformat"):
                date_posted = date_posted.isoformat()
            elif date_posted is not None and not isinstance(date_posted, str):
                date_posted = str(date_posted)
            raw_json = json.dumps(job, default=str, ensure_ascii=False)
            conn.execute(
                """
                INSERT INTO jobs (job_id, title, company, location, url, source, date_posted, description, first_seen_at, last_seen_at, raw_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(job_id) DO UPDATE SET
                    title=excluded.title, company=excluded.company, location=excluded.location,
                    url=excluded.url, source=excluded.source, date_posted=excluded.date_posted,
                    description=excluded.description, last_seen_at=excluded.last_seen_at, raw_json=excluded.raw_json
                """,
                (job_id, title, company, (job.get("location") or ""), url, (job.get("source") or ""),
                date_posted, (job.get("description") or "")[:65535], now, now, raw_json),
            )
        conn.commit()
    finally:
        conn.close()


def query_jobs(days: int = 7, israel_only: bool = True) -> List[Dict]:
    database.init_db()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    conn = database.get_connection()
    rows = []
    try:
        cur = conn.execute(
            "SELECT raw_json FROM jobs WHERE date_posted >= ? OR date_posted IS NULL ORDER BY date_posted DESC",
            (cutoff,),
        )
        rows = cur.fetchall()
    finally:
        conn.close()
    jobs = []
    for (raw_json_str,) in rows:
        try:
            job = json.loads(raw_json_str)
            if israel_only and not is_in_israel(job):
                continue
            jobs.append(job)
        except (json.JSONDecodeError, TypeError):
            continue
    return jobs


def count_jobs() -> int:
    database.init_db()
    conn = database.get_connection()
    try:
        return conn.execute("SELECT COUNT(*) FROM jobs").fetchone()[0]
    finally:
        conn.close()

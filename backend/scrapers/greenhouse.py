"""Greenhouse job scraper."""

import httpx
import urllib3
from typing import List, Dict, Optional
from datetime import datetime, timedelta, timezone

from backend import config
from backend import seniority
from backend.scrapers.base import JobScraper

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class GreenhouseScraper(JobScraper):
    BASE_URL = "https://boards-api.greenhouse.io/v1/boards"

    def __init__(self, board_tokens: List[str] = None):
        self.board_tokens = board_tokens or config.GREENHOUSE_TOKENS

    def fetch_jobs(self, days: int = 7) -> List[Dict]:
        all_jobs = []
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        for token in self.board_tokens:
            try:
                url = f"{self.BASE_URL}/{token}/jobs?content=true"
                with httpx.Client(timeout=30.0, verify=False) as client:
                    response = client.get(url)
                    response.raise_for_status()
                    data = response.json()
                    for job in data.get("jobs", []):
                        job_data = self._parse_job(job, token)
                        if job_data:
                            date_posted = job_data.get("date_posted")
                            if date_posted:
                                if isinstance(date_posted, datetime) and date_posted.tzinfo is None:
                                    date_posted = date_posted.replace(tzinfo=timezone.utc)
                                    job_data["date_posted"] = date_posted
                                if date_posted >= cutoff:
                                    all_jobs.append(job_data)
                            else:
                                all_jobs.append(job_data)
            except Exception as e:
                print(f"Error fetching Greenhouse {token}: {e}")
        return all_jobs

    def _parse_job(self, job: dict, board_token: str) -> Optional[Dict]:
        try:
            date_posted = None
            if job.get("updated_at"):
                try:
                    date_posted = datetime.fromisoformat(job["updated_at"].replace("Z", "+00:00"))
                except Exception:
                    pass
            location = (job.get("location", {}) or {}).get("name", "") if isinstance(job.get("location"), dict) else (job.get("location") or "")
            company = (job.get("departments", [{}])[0].get("name", "") if job.get("departments") else "") or ""
            description = job.get("content", "") or ""
            job_dict = {
                "title": job.get("title", "") or "",
                "company": company,
                "location": location,
                "date_posted": date_posted,
                "url": job.get("absolute_url", f"https://boards.greenhouse.io/{board_token}/jobs/{job.get('id')}"),
                "source": "greenhouse",
                "description": description,
                "requirements": description,
            }
            return seniority.add_seniority_to_job(job_dict)
        except Exception as e:
            print(f"Error parsing Greenhouse job: {e}")
            return None

"""Lever job scraper."""

import httpx
import urllib3
from typing import List, Dict, Optional
from datetime import datetime, timezone, timedelta

from backend import config
from backend import seniority
from backend.scrapers.base import JobScraper

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class LeverScraper(JobScraper):
    BASE_URL = "https://api.lever.co/v0/postings"

    def __init__(self, company_slugs: List[str] = None):
        self.company_slugs = company_slugs or config.LEVER_SLUGS

    def fetch_jobs(self, days: int = 7) -> List[Dict]:
        all_jobs = []
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        for slug in self.company_slugs:
            try:
                url = f"{self.BASE_URL}/{slug}"
                with httpx.Client(timeout=30.0, verify=False) as client:
                    response = client.get(url)
                    response.raise_for_status()
                    jobs = response.json()
                    if not isinstance(jobs, list):
                        continue
                    for job in jobs:
                        job_data = self._parse_job(job, slug)
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
                print(f"Error fetching Lever {slug}: {e}")
        return all_jobs

    def _parse_job(self, job: dict, slug: str) -> Optional[Dict]:
        try:
            date_posted = None
            if job.get("createdAt"):
                try:
                    date_posted = datetime.fromtimestamp(job["createdAt"] / 1000, tz=timezone.utc)
                except Exception:
                    pass
            location = ""
            if isinstance(job.get("categories"), dict):
                location = job.get("categories", {}).get("location", "") or ""
            company = ""
            if isinstance(job.get("categories"), dict):
                company = job.get("categories", {}).get("team", "") or ""
            description = job.get("descriptionPlain", "") or job.get("description", "") or ""
            job_dict = {
                "title": job.get("text", "") or "",
                "company": company or slug.title(),
                "location": location,
                "date_posted": date_posted,
                "url": job.get("hostedUrl", f"https://jobs.lever.co/{slug}"),
                "source": "lever",
                "description": description,
                "requirements": description,
            }
            return seniority.add_seniority_to_job(job_dict)
        except Exception as e:
            print(f"Error parsing Lever job: {e}")
            return None

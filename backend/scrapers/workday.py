"""Workday job scraper."""

import re
import httpx
import urllib3
from typing import List, Dict, Optional
from datetime import datetime, timedelta, timezone

from backend import config
from backend import seniority
from backend.scrapers.base import JobScraper

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class WorkdayScraper(JobScraper):
    def __init__(self, board_urls: List[str] = None):
        self.board_urls = board_urls or config.WORKDAY_BOARDS

    def fetch_jobs(self, days: int = 7) -> List[Dict]:
        all_jobs = []
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        for board_url in self.board_urls:
            try:
                jobs = self._scrape_board(board_url, cutoff)
                all_jobs.extend(jobs)
            except Exception as e:
                print(f"Error fetching Workday {board_url}: {e}")
        return all_jobs

    def _scrape_board(self, board_url: str, cutoff_date: datetime) -> List[Dict]:
        jobs = []
        try:
            url_match = re.search(r'https://([^.]+)\.wd(\d+)\.myworkdayjobs\.com/en-US/([^?]+)', board_url)
            if not url_match:
                return jobs
            company_subdomain, wd_number, site_name = url_match.group(1), url_match.group(2), url_match.group(3)
            location_filter = None
            lm = re.search(r'locationHierarchy1=([^&]+)', board_url)
            if lm:
                location_filter = lm.group(1)
            api_urls = [
                f"https://{company_subdomain}.wd{wd_number}.myworkdayjobs.com/wday/cxs/search/{site_name}/{site_name}",
                f"https://{company_subdomain}.wd{wd_number}.myworkdayjobs.com/wday/cxs/search/{site_name}",
            ]
            page, page_size = 0, 20
            applied_facets = {"locationHierarchy1": [location_filter]} if location_filter else {}
            payload = {"appliedFacets": applied_facets, "limit": page_size, "offset": page * page_size, "searchText": ""}
            data = None
            for api_url in api_urls:
                try:
                    with httpx.Client(timeout=30.0, verify=False, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0", "Content-Type": "application/json", "Accept": "application/json"}) as client:
                        r = client.post(api_url, json=payload)
                        if r.status_code == 200:
                            data = r.json()
                            break
                        if r.status_code == 404:
                            continue
                        if location_filter:
                            r = client.post(api_url, json={"appliedFacets": {}, "limit": page_size, "offset": 0, "searchText": ""})
                            if r.status_code == 200:
                                data = r.json()
                                break
                except Exception as e:
                    print(f"Workday API {api_url}: {e}")
            if not data:
                return jobs
            for posting in data.get("jobPostings", []):
                job_data = self._parse_job(posting, company_subdomain, site_name, wd_number)
                if job_data:
                    dp = job_data.get("date_posted")
                    if dp and isinstance(dp, datetime):
                        if dp.tzinfo is None:
                            dp = dp.replace(tzinfo=timezone.utc)
                            job_data["date_posted"] = dp
                        if dp >= cutoff_date:
                            jobs.append(job_data)
                    else:
                        jobs.append(job_data)
        except Exception as e:
            print(f"Error scraping Workday {board_url}: {e}")
        return jobs

    def _parse_job(self, posting: dict, company_subdomain: str, site_name: str, wd_number: str = "5") -> Optional[Dict]:
        try:
            title = posting.get("title", "") or ""
            if not title:
                return None
            locations = posting.get("locationsText", "")
            location = locations if isinstance(locations, str) else ", ".join(locations) if isinstance(locations, list) else ""
            company = posting.get("company", {}).get("name", "") if isinstance(posting.get("company"), dict) else ""
            if not company:
                company = company_subdomain.replace("-", " ").title()
            date_posted = None
            posted_on = posting.get("postedOn", "")
            if posted_on:
                try:
                    date_posted = datetime.fromisoformat(posted_on.replace("Z", "+00:00"))
                except Exception:
                    try:
                        date_posted = datetime.fromtimestamp(int(posted_on) / 1000, tz=timezone.utc)
                    except Exception:
                        pass
            job_id = posting.get("externalPath", "") or posting.get("id", "")
            if job_id:
                job_url = f"https://{company_subdomain}.wd{wd_number}.myworkdayjobs.com{job_id}" if job_id.startswith("/") else (job_id if job_id.startswith("http") else f"https://{company_subdomain}.wd{wd_number}.myworkdayjobs.com/en-US/{site_name}{job_id}")
            else:
                job_url = f"https://{company_subdomain}.wd{wd_number}.myworkdayjobs.com/en-US/{site_name}"
            description = posting.get("jobDescription", "") or posting.get("description", "") or ""
            job_dict = {"title": title, "company": company, "location": location, "date_posted": date_posted, "url": job_url, "source": "workday", "description": description}
            return seniority.add_seniority_to_job(job_dict)
        except Exception as e:
            print(f"Error parsing Workday job: {e}")
            return None

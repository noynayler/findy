"""Comeet job scraper (search-based board discovery)."""

import re
import json
import time
from urllib.parse import unquote, urlparse, parse_qs
from typing import List, Dict, Optional, Set, Tuple
from datetime import datetime, timedelta, timezone

import httpx
from bs4 import BeautifulSoup

from backend import seniority
from backend.scrapers.base import JobScraper

COMEET_BOARD_PATTERN = re.compile(r"https?://(?:www\.)?comeet\.com/jobs/([^/]+)/([^/?#]+)", re.IGNORECASE)


class ComeetAutoSource(JobScraper):
    BASE_URL = "https://www.comeet.com/jobs"

    def __init__(self, max_boards_from_search: int = 80):
        self.max_boards_from_search = max_boards_from_search
        self.discovered_boards: List[str] = []
        self.cache_valid_boards: Set[str] = set()

    def discover_and_fetch_jobs(self, days: int = 30, search_query: str = "site:comeet.com/jobs israel", max_boards_from_search: Optional[int] = None) -> List[Dict]:
        all_jobs = []
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        limit = max_boards_from_search if max_boards_from_search is not None else self.max_boards_from_search
        boards = self._discover_board_urls_via_search(search_query=search_query, max_results=limit)
        for board_url, company_slug in boards:
            try:
                company_name = company_slug.replace("-", " ").replace("_", " ")
                jobs = self._scrape_board(board_url, company_name, cutoff_date)
                all_jobs.extend(jobs)
                self.discovered_boards.append(board_url)
                time.sleep(1)
            except Exception as e:
                print(f"  Error scanning board {board_url}: {e}")
        return all_jobs

    def fetch_jobs(self, days: int = 7) -> List[Dict]:
        return self.discover_and_fetch_jobs(days=days)

    def _discover_board_urls_via_search(self, search_query: str = "site:comeet.com/jobs israel", max_results: int = 80) -> List[Tuple[str, str]]:
        seen: Set[str] = set()
        boards: List[Tuple[str, str]] = []
        try:
            with httpx.Client(timeout=15.0, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}) as client:
                resp = client.get("https://html.duckduckgo.com/html/", params={"q": search_query})
                resp.raise_for_status()
                html = resp.text
        except Exception as e:
            print(f"  Search request failed: {e}")
            return boards
        for href in re.findall(r'href="([^"]+)"', html):
            if "uddg=" in href:
                try:
                    parsed = urlparse(href)
                    qs = parse_qs(parsed.query)
                    uddg = qs.get("uddg", [None])[0]
                    if uddg:
                        full_url = unquote(uddg)
                        if "comeet.com/jobs" in full_url:
                            m = COMEET_BOARD_PATTERN.search(full_url)
                            if m:
                                company_slug, board_id = m.group(1), m.group(2)
                                board_url = f"{self.BASE_URL}/{company_slug}/{board_id}"
                                if board_url not in seen:
                                    seen.add(board_url)
                                    boards.append((board_url, company_slug))
                                    if len(boards) >= max_results:
                                        return boards
                except Exception:
                    continue
            if "comeet.com/jobs" in href:
                m = COMEET_BOARD_PATTERN.search(href)
                if m:
                    company_slug, board_id = m.group(1), m.group(2)
                    board_url = f"{self.BASE_URL}/{company_slug}/{board_id}"
                    if board_url not in seen:
                        seen.add(board_url)
                        boards.append((board_url, company_slug))
                        if len(boards) >= max_results:
                            return boards
        for m in COMEET_BOARD_PATTERN.finditer(html):
            company_slug, board_id = m.group(1), m.group(2)
            board_url = f"{self.BASE_URL}/{company_slug}/{board_id}"
            if board_url not in seen:
                seen.add(board_url)
                boards.append((board_url, company_slug))
                if len(boards) >= max_results:
                    return boards
        return boards

    def _scrape_board(self, board_url: str, company_name: str, cutoff_date: datetime) -> List[Dict]:
        jobs = []
        try:
            with httpx.Client(timeout=30.0, follow_redirects=True, verify=False, headers={"User-Agent": "Mozilla/5.0"}) as client:
                response = client.get(board_url)
                response.raise_for_status()
                soup = BeautifulSoup(response.text, "html.parser")
            for script in soup.find_all("script"):
                if not script.string:
                    continue
                content = script.string
                bracket_count = 0
                start_idx = -1
                for idx, char in enumerate(content):
                    if char == "[":
                        if bracket_count == 0:
                            start_idx = idx
                        bracket_count += 1
                    elif char == "]":
                        bracket_count -= 1
                        if bracket_count == 0 and start_idx >= 0:
                            array_str = content[start_idx : idx + 1]
                            if '"name"' in array_str and '"department"' in array_str:
                                try:
                                    positions_data = json.loads(array_str)
                                    if isinstance(positions_data, list) and positions_data:
                                        first = positions_data[0]
                                        if isinstance(first, dict) and "name" in first and "department" in first:
                                            for pos in positions_data:
                                                if isinstance(pos, dict):
                                                    job = self._parse_position(pos, board_url, company_name, cutoff_date)
                                                    if job:
                                                        jobs.append(job)
                                            break
                                except json.JSONDecodeError:
                                    try:
                                        array_str = re.sub(r",\s*}", "}", array_str)
                                        array_str = re.sub(r",\s*]", "]", array_str)
                                        positions_data = json.loads(array_str)
                                        if isinstance(positions_data, list) and positions_data and isinstance(positions_data[0], dict) and "name" in positions_data[0]:
                                            for pos in positions_data:
                                                if isinstance(pos, dict):
                                                    job = self._parse_position(pos, board_url, company_name, cutoff_date)
                                                    if job:
                                                        jobs.append(job)
                                            break
                                    except Exception:
                                        pass
                            start_idx = -1
        except Exception as e:
            print(f"  Error scraping board {board_url}: {e}")
        return jobs

    def _parse_position(self, pos: Dict, board_url: str, company_name: str, cutoff_date: datetime) -> Optional[Dict]:
        try:
            location = ""
            if isinstance(pos.get("location"), dict):
                loc_obj = pos.get("location", {})
                location = loc_obj.get("name", "") or loc_obj.get("city", "")
            else:
                location = pos.get("location", "")
            job_url = pos.get("url_comeet_hosted_page", "") or pos.get("url_recruit_hosted_page", "") or pos.get("url", "")
            if not job_url:
                uid = pos.get("uid", "")
                name_slug = re.sub(r"[^a-z0-9-]", "", pos.get("name", "").lower().replace(" ", "-"))
                company_id = re.search(r"/jobs/([^/]+)/", board_url)
                board_id_match = re.search(r"/jobs/[^/]+/([^/]+)", board_url)
                if company_id and board_id_match and uid:
                    job_url = f"https://www.comeet.com/jobs/{company_id.group(1)}/{board_id_match.group(1)}/{name_slug}/{uid}"
            if not job_url:
                job_url = board_url
            title = pos.get("name", "") or pos.get("title", "")
            if not title:
                return None
            description = ""
            if isinstance(pos.get("custom_fields"), dict):
                details = pos.get("custom_fields", {}).get("details", [])
                if isinstance(details, list):
                    desc_parts = []
                    for detail in details:
                        if isinstance(detail, dict) and detail.get("value"):
                            desc_parts.append(re.sub(r"<[^>]+>", "", detail["value"]))
                    description = " ".join(desc_parts)
            if not description:
                description = title
            date_posted = None
            if pos.get("time_updated"):
                try:
                    date_posted = datetime.fromisoformat(pos["time_updated"].replace("Z", "+00:00"))
                except Exception:
                    pass
            if date_posted and isinstance(date_posted, datetime):
                if date_posted.tzinfo is None:
                    date_posted = date_posted.replace(tzinfo=timezone.utc)
                if date_posted < cutoff_date:
                    return None
            job_dict = {"title": title, "company": company_name.title(), "location": location, "date_posted": date_posted, "url": job_url, "source": "comeet", "description": description}
            return seniority.add_seniority_to_job(job_dict)
        except Exception:
            return None

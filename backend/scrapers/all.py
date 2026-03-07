"""Orchestrate scraping from all sources."""

import re
from typing import List, Dict, Optional
from datetime import datetime, timedelta, timezone

from backend import config
from backend.scrapers.greenhouse import GreenhouseScraper
from backend.scrapers.lever import LeverScraper
from backend.scrapers.workday import WorkdayScraper


def scrape_all_jobs(
    days: int = 7,
    max_comeet_companies: Optional[int] = None,
    skip_comeet: bool = False,
) -> List[Dict]:
    all_jobs = []
    all_jobs.extend(GreenhouseScraper().fetch_jobs(days=days))
    all_jobs.extend(LeverScraper().fetch_jobs(days=days))
    all_jobs.extend(WorkdayScraper().fetch_jobs(days=days))
    if not skip_comeet:
        try:
            from backend.scrapers.comeet import ComeetAutoSource
            limit = max_comeet_companies if max_comeet_companies is not None else config.COMEET_MAX_COMPANIES
            comeet_jobs = ComeetAutoSource(max_boards_from_search=limit).discover_and_fetch_jobs(days=days)
            all_jobs.extend(comeet_jobs)
        except Exception as e:
            print(f"Error loading Comeet: {e}")
    elif config.COMEET_BOARDS_WEB:
        try:
            from backend.scrapers.comeet import ComeetAutoSource
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
            comeet = ComeetAutoSource(max_boards_from_search=0)
            for board_url in config.COMEET_BOARDS_WEB:
                try:
                    match = re.search(r"/jobs/([^/]+)/", board_url)
                    company_name = match.group(1).replace("-", " ").title() if match else "Unknown"
                    jobs = comeet._scrape_board(board_url, company_name, cutoff_date)
                    all_jobs.extend(jobs)
                except Exception as e:
                    print(f"Error scraping fixed board {board_url}: {e}")
        except Exception as e:
            print(f"Error loading Comeet fixed boards: {e}")
    return all_jobs

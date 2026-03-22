#!/usr/bin/env python3
"""
One-shot job scrape + upsert to public.jobs (Supabase).
For Render Cron: PYTHONPATH=. python run_daily_scrape.py

Mirrors backend.app.refresh_jobs scrape/upsert logic (no Flask).
"""
from __future__ import annotations

import logging
import sys
import traceback

from backend import config, jobs_store
from backend.job_scraper import scrape_all_jobs

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("daily_scrape")


def main() -> int:
    log.info("Daily scrape starting")
    try:
        scraped = scrape_all_jobs(
            days=config.DEFAULT_DAYS_BACK,
            max_comeet_companies=config.COMEET_MAX_BOARDS_FULL_SCAN,
            skip_comeet=False,
        )
        log.info("Scrape finished: %s job dict(s) collected", len(scraped))

        jobs_store.upsert_jobs(scraped)
        log.info("Upsert to public.jobs completed")

        total = jobs_store.count_jobs()
        log.info("Total rows in jobs table: %s", total)
        log.info("Daily scrape finished successfully")
        return 0
    except Exception as e:
        log.error("Daily scrape failed: %s", e)
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())

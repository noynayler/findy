"""Base scraper interface."""

from abc import ABC, abstractmethod
from typing import List, Dict


class JobScraper(ABC):
    @abstractmethod
    def fetch_jobs(self, days: int = 7) -> List[Dict]:
        pass

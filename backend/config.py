"""Configuration constants and paths."""

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent

GREENHOUSE_TOKENS = [
    "axonius", "lightricks", "bluevineisrael", "similarweb", "payoneer",
    "riskified", "redis", "melio", "appsflyer", "yotpo",
]
LEVER_SLUGS = ["walkme", "CYE"]
WORKDAY_BOARDS = [
    "https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite?locationHierarchy1=2fcb99c455831013ea52bbe14cf9326c",
]
COMEET_BOARDS = []
COMEET_MAX_COMPANIES = 50
COMEET_MAX_COMPANIES_WEB = 0
COMEET_MAX_BOARDS_FULL_SCAN = 80
COMEET_BOARDS_WEB = ["https://www.comeet.com/jobs/helfy/3A.008"]

DEFAULT_DAYS_BACK = 7
DEFAULT_SENIORITY = "entry-level"
USE_EMBEDDING_MATCHER = False
INCLUDE_UNKNOWN_SENIORITY = False

TECH_JOB_KEYWORDS = [
    "developer", "engineer", "programmer", "software", "backend", "frontend",
    "full stack", "fullstack", "devops", "sre", "qa", "test", "data",
    "analyst", "architect", "scientist", "ml", "ai", "cyber", "security",
    "product", "manager", "technical", "it", "infrastructure", "cloud",
]
ISRAEL_LOCATION_KEYWORDS = [
    "israel", "tel aviv", "tel-aviv", "jerusalem", "haifa", "herzliya",
    "ramat gan", "beer sheva", "netanya", "petah tikva", "rishon lezion",
]
ISRAEL_REMOTE_KEYWORDS = ["israel remote", "remote israel", "israeli remote", "tel aviv remote"]

"""Seniority detection (rule-based)."""

import re
from typing import Dict, Optional, Tuple


INTERN_KEYWORDS = ["intern", "internship", "student", "co-op", "coop"]
ENTRY_KEYWORDS = ["entry level", "entry-level", "entry", "graduate", "new grad", "associate", "jr", "junior", "trainee"]
JUNIOR_KEYWORDS = ["junior", "jr", "j2", "level 1", "l1"]
MID_KEYWORDS = ["mid", "mid-level", "mid level", "intermediate"]
SENIOR_KEYWORDS = ["senior", "sr", "s2", "s3", "level 2", "l2", "level 3", "l3"]
LEAD_KEYWORDS = ["lead", "tech lead", "team lead", "technical lead"]
STAFF_KEYWORDS = ["staff", "staff engineer"]
PRINCIPAL_KEYWORDS = ["principal", "principal engineer"]
MANAGER_KEYWORDS = ["manager", "engineering manager", "head of", "director", "vp", "vice president", "chief", "cto", "cpo", "head"]


def _parse_years(text: str) -> Tuple[Optional[int], Optional[int]]:
    if not text:
        return None, None
    text_lower = text.lower()
    patterns = [
        (r"(\d+)\s*[-–—]\s*(\d+)\s*years?", lambda m: (int(m.group(1)), int(m.group(2)))),
        (r"(\d+)\+?\s*years?", lambda m: (int(m.group(1)), None)),
        (r"at least\s+(\d+)\s+years?", lambda m: (int(m.group(1)), None)),
        (r"minimum\s+(\d+)\s+years?", lambda m: (int(m.group(1)), None)),
    ]
    matches = []
    for pattern, extractor in patterns:
        for match in re.finditer(pattern, text_lower):
            try:
                r = extractor(match)
                if r:
                    matches.append(r)
            except (ValueError, IndexError):
                continue
    if not matches:
        return None, None
    min_y = max(m[0] for m in matches if m[0] is not None)
    max_list = [m[1] for m in matches if m[1] is not None]
    return min_y, max(max_list) if max_list else None


def _classify_from_title(title: str) -> Optional[str]:
    if not title:
        return None
    t = title.lower()
    if any(k in t for k in MANAGER_KEYWORDS):
        return "manager"
    if any(k in t for k in PRINCIPAL_KEYWORDS):
        return "principal"
    if any(k in t for k in STAFF_KEYWORDS):
        return "staff"
    if any(k in t for k in LEAD_KEYWORDS):
        return "lead"
    if any(k in t for k in SENIOR_KEYWORDS):
        return "senior"
    if any(k in t for k in MID_KEYWORDS):
        return "mid"
    if any(k in t for k in JUNIOR_KEYWORDS):
        return "junior"
    if any(k in t for k in ENTRY_KEYWORDS):
        return "entry"
    if any(k in t for k in INTERN_KEYWORDS):
        return "intern"
    return None


def classify_seniority(title: str, description: str) -> Dict:
    title = title or ""
    description = description or ""
    min_years, max_years = _parse_years(description)
    title_label = _classify_from_title(title)
    if title_label:
        label = title_label
        reason = f"Title contains '{title_label}'"
        if label in ["senior", "lead", "staff", "principal", "manager"] and (min_years is None or min_years < 5):
            min_years = 5
    else:
        if min_years is not None:
            if min_years == 0:
                label, reason = "entry", "0 years required"
            elif min_years <= 2:
                label, reason = "junior", f"{min_years} years required"
            elif min_years <= 4:
                label, reason = "mid", f"{min_years} years required"
            elif min_years >= 5:
                label, reason = "senior", f"{min_years}+ years required"
            else:
                label, reason = "unknown", "Could not determine"
        else:
            label, reason = "unknown", "No seniority indicators"
    return {"label": label, "min_years": min_years, "max_years": max_years, "reason": reason}


def add_seniority_to_job(job: Dict) -> Dict:
    data = classify_seniority(job.get("title", ""), job.get("description", ""))
    job["seniority_label"] = data["label"]
    job["min_years"] = data["min_years"]
    job["max_years"] = data["max_years"]
    job["seniority_reason"] = data["reason"]
    return job


def matches_selected_seniority(job: Dict, selected: str, include_unknown: bool = False) -> bool:
    if not selected or selected.lower() in ["any", "all", ""]:
        return True
    selected = selected.lower().strip()
    label = (job.get("seniority_label") or "unknown").lower()
    min_years = job.get("min_years")
    title_lower = (job.get("title") or "").lower()
    if label == "unknown":
        return include_unknown
    if selected in ("entry-level", "entry level"):
        selected = "entry"
    exclude_titles = ["senior", "lead", "staff", "principal", "engineering manager", "head of", "director", "vp ", "cto", "cpo"]
    if selected == "intern":
        return label == "intern" or (min_years == 0 and any(k in title_lower for k in INTERN_KEYWORDS))
    if selected == "entry":
        if any(k in title_lower for k in exclude_titles):
            return False
        if label in ["junior", "mid", "senior", "lead", "staff", "principal", "manager"]:
            return False
        return label == "entry" or (min_years is not None and 0 <= min_years <= 2)
    if selected == "junior":
        if any(k in title_lower for k in exclude_titles):
            return False
        if label in ["entry", "mid", "senior", "lead", "staff", "principal", "manager"]:
            return False
        return label == "junior" or (min_years is not None and 1 <= min_years <= 3)
    if selected == "mid":
        if any(k in title_lower for k in exclude_titles):
            return False
        if label in ["junior", "entry", "senior", "lead", "staff", "principal", "manager"]:
            return False
        return label == "mid" or (min_years is not None and 3 <= min_years <= 5)
    if selected == "senior":
        return label in ["senior", "lead", "manager"] or (min_years is not None and min_years >= 5)
    if selected in ["lead", "staff", "principal"]:
        return label == selected
    if selected == "manager":
        return label == "manager"
    return label == selected

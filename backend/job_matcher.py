"""
Job filtering (location, date, seniority, title) and resume-to-job ranking.
"""

import re
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Set, Optional

from backend import config
from backend import jobs_store
from backend import seniority as seniority_module


def is_within_date_range(job: Dict, days: int = None) -> bool:
    if days is None:
        days = config.DEFAULT_DAYS_BACK
    date_posted = job.get("date_posted")
    if date_posted is None:
        return True
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    if isinstance(date_posted, str):
        try:
            date_posted = datetime.fromisoformat(date_posted.replace("Z", "+00:00"))
        except Exception:
            return True
    if isinstance(date_posted, datetime) and date_posted.tzinfo is None:
        date_posted = date_posted.replace(tzinfo=timezone.utc)
    return date_posted >= cutoff


def matches_job_title(job: Dict, title_keyword: Optional[str] = None) -> bool:
    if not title_keyword:
        return True
    return (title_keyword or "").lower() in (job.get("title") or "").lower()


def is_tech_job(job: Dict) -> bool:
    text = f"{job.get('title') or ''} {job.get('description') or ''}".lower()
    for kw in config.TECH_JOB_KEYWORDS:
        if kw in text:
            return True
    if (job.get("source") or "").lower() in ["greenhouse", "lever"]:
        return True
    return False


def filter_by_seniority(jobs: List[Dict], selected: str, include_unknown: bool = None) -> List[Dict]:
    if include_unknown is None:
        include_unknown = config.INCLUDE_UNKNOWN_SENIORITY
    if not selected or selected.lower() in ["any", "all", ""]:
        return jobs
    return [j for j in jobs if seniority_module.matches_selected_seniority(j, selected, include_unknown)]


def filter_jobs(
    jobs: List[Dict],
    days: int = None,
    seniority: Optional[str] = None,
    title_keyword: Optional[str] = None,
    debug: bool = False,
) -> List[Dict]:
    if days is None:
        days = config.DEFAULT_DAYS_BACK
    for job in jobs:
        if "seniority_label" not in job:
            seniority_module.add_seniority_to_job(job)
    filtered = []
    for job in jobs:
        if not jobs_store.is_in_israel(job):
            continue
        if not is_within_date_range(job, days):
            continue
        if not is_tech_job(job):
            continue
        if not matches_job_title(job, title_keyword):
            continue
        filtered.append(job)
    if seniority:
        filtered = filter_by_seniority(filtered, seniority)
    if debug and jobs:
        print(f"  Filter: {len(jobs)} -> {len(filtered)} jobs")
    return filtered


# --- Resume matching (keyword + optional semantic) ---
def _extract_skills(text: str, min_len: int = 2, max_tokens: int = 4) -> Set[str]:
    if not text:
        return set()
    text_lower = text.lower()
    tokens = re.findall(r"[a-z0-9]+(?:[-'][a-z0-9]+)*", text_lower)
    skills = set()
    for i, t in enumerate(tokens):
        if min_len <= len(t) <= 30:
            skills.add(t)
        if max_tokens >= 2 and i + 1 < len(tokens):
            bigram = f"{t} {tokens[i+1]}"
            if 3 <= len(bigram) <= 40:
                skills.add(bigram)
        if max_tokens >= 3 and i + 2 < len(tokens):
            trigram = f"{t} {tokens[i+1]} {tokens[i+2]}"
            if 4 <= len(trigram) <= 50:
                skills.add(trigram)
    return skills


def _score_skills(resume_skills: Set[str], job_skills: Set[str]) -> float:
    if not job_skills:
        return 0.0
    return min(1.0, len(resume_skills & job_skills) / len(job_skills))


_embedding_model = None


def _get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
        except Exception:
            pass
    return _embedding_model


def _calculate_match(resume_text: str, job: Dict, use_embedding: bool = False) -> Dict:
    job_text = f"{job.get('title', '')} {job.get('description', '')} {job.get('requirements', '')}"
    resume_skills = _extract_skills(resume_text)
    job_skills = _extract_skills(job_text)
    keyword_score = _score_skills(resume_skills, job_skills)
    matching = list(resume_skills & job_skills)[:10]
    missing = list(job_skills - resume_skills)[:10]
    semantic_score = None
    if use_embedding and config.USE_EMBEDDING_MATCHER:
        model = _get_embedding_model()
        if model is not None:
            try:
                from sklearn.metrics.pairwise import cosine_similarity
                import numpy as np
                res_emb = model.encode((resume_text or " ")[:8000])
                job_emb = model.encode((job_text or " ")[:8000])
                semantic_score = float(np.clip(cosine_similarity([res_emb], [job_emb])[0][0], 0, 1))
            except Exception:
                pass
    final = 0.5 * keyword_score + 0.5 * semantic_score if semantic_score is not None else keyword_score
    return {
        "score": final,
        "keyword_score": keyword_score,
        "semantic_score": semantic_score,
        "matched_keywords": matching,
        "missing_keywords": missing,
    }


def rank_jobs(
    resume_text: str,
    jobs: List[Dict],
    target_role: str = "",
    use_embedding: bool = False,
) -> List[Dict]:
    for job in jobs:
        try:
            r = _calculate_match(resume_text, job, use_embedding)
            job["match_score"] = r["score"]
            job["keyword_score"] = r["keyword_score"]
            if r.get("semantic_score") is not None:
                job["semantic_score"] = r["semantic_score"]
            job["matched_keywords"] = r["matched_keywords"]
            job["missing_keywords"] = r["missing_keywords"]
        except Exception as e:
            job["match_score"] = 0.0
            job["keyword_score"] = 0.0
            job["matched_keywords"] = []
            job["missing_keywords"] = []
            job["match_error"] = str(e)
    jobs.sort(key=lambda x: (x.get("match_score") or 0, not x.get("date_unknown", False)), reverse=True)
    return jobs

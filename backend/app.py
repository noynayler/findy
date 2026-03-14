"""
Flask app: job search, resume upload, refresh. Serves frontend from frontend/.
"""

import sys
import traceback
from pathlib import Path
from datetime import datetime

from flask import Flask, render_template, request, jsonify

from backend import config
from backend import database
from backend import jobs_store
from backend import resume_parser
from backend.job_scraper import scrape_all_jobs
from backend.job_matcher import filter_jobs, rank_jobs

# Project root on path (for run from any cwd)
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
except ImportError:
    pass

FRONTEND_DIR = ROOT / "frontend"
app = Flask(__name__, template_folder=str(FRONTEND_DIR), static_folder=str(FRONTEND_DIR), static_url_path="/static")
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16MB


def _startup_summary():
    database.init_db()
    n = jobs_store.count_jobs()
    sources = ["Greenhouse", "Lever", "Workday"]
    if config.COMEET_MAX_COMPANIES_WEB or config.COMEET_MAX_BOARDS_FULL_SCAN:
        sources.append("Comeet")
    print("---")
    print("DB initialized (data/jobs.db)")
    print(f"Jobs stored: {n}")
    print(f"Sources: {', '.join(sources)}")
    print("---")


_startup_summary()


@app.after_request
def cors(response):
    response.headers.add("Access-Control-Allow-Origin", "*")
    response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
    response.headers.add("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS")
    return response


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"status": "ok", "message": "Server is running"})


@app.route("/api/resume/upload", methods=["POST"])
def upload_resume():
    try:
        if "resume" not in request.files:
            return jsonify({"success": False, "error": "No file provided"}), 400
        file = request.files["resume"]
        if not file.filename:
            return jsonify({"success": False, "error": "No file selected"}), 400
        if not file.filename.lower().endswith(".pdf"):
            return jsonify({"success": False, "error": "Only PDF files are supported"}), 400
        pdf_bytes = file.read()
        if len(pdf_bytes) == 0:
            return jsonify({"success": False, "error": "Empty file"}), 400
        resume_text, _ = resume_parser.extract_text_from_pdf(pdf_bytes, enable_ocr=False)
        if not resume_text:
            return jsonify({"success": False, "error": "Could not extract text from PDF"}), 400
        return jsonify({"success": True, "resume_text": resume_text, "text_length": len(resume_text)})
    except Exception as e:
        print(f"Error in upload_resume: {e}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/jobs/search", methods=["GET", "POST"])
def search_jobs():
    try:
        if request.method == "POST":
            data = request.get_json(silent=True) or {}
            title_keyword = (data.get("title") or "").strip() or None
            seniority_raw = (data.get("seniority") or "").strip()
            seniority = seniority_raw if seniority_raw and seniority_raw.lower() != "any" else None
            try:
                days = int(data.get("days", config.DEFAULT_DAYS_BACK))
            except (TypeError, ValueError):
                days = config.DEFAULT_DAYS_BACK
            resume_text = (data.get("resume_text") or "").strip() or None
        else:
            title_keyword = request.args.get("title", "").strip() or None
            seniority_raw = request.args.get("seniority", "").strip()
            seniority = seniority_raw if seniority_raw and seniority_raw.lower() != "any" else None
            try:
                days = int(request.args.get("days", config.DEFAULT_DAYS_BACK))
            except (TypeError, ValueError):
                days = config.DEFAULT_DAYS_BACK
            resume_text = None
        if resume_text is not None:
            resume_text = (resume_text or "").strip() or None

        print(f"Search: scraping (last {days} days)...")
        try:
            scraped = scrape_all_jobs(days=days, max_comeet_companies=config.COMEET_MAX_BOARDS_FULL_SCAN, skip_comeet=False)
            jobs_store.upsert_jobs(scraped)
            print(f"Search: scraped {len(scraped)} jobs")
        except Exception as err:
            print(f"Search: scrape failed ({err}), using existing DB")
            traceback.print_exc()

        all_jobs = jobs_store.query_jobs(days=days, israel_only=True)
        basic_filtered = filter_jobs(jobs=all_jobs, days=days, seniority=None, title_keyword=None, debug=True)
        total_count = len(basic_filtered)
        filtered_jobs = filter_jobs(jobs=all_jobs, days=days, seniority=seniority, title_keyword=title_keyword, debug=True) if (title_keyword or seniority) else basic_filtered

        resume_matched = False
        if resume_text:
            try:
                if len(resume_text) > 25_000:
                    resume_text = resume_text[:25_000]
                filtered_jobs = rank_jobs(resume_text, filtered_jobs, target_role="", use_embedding=config.USE_EMBEDDING_MATCHER)
                resume_matched = True
            except Exception as err:
                print(f"Resume matching error: {err}")
                traceback.print_exc()

        for job in filtered_jobs:
            if job.get("date_posted") and isinstance(job["date_posted"], datetime):
                job["date_posted"] = job["date_posted"].isoformat()
            if resume_matched:
                job["matching_skills"] = list(job.get("matched_keywords") or [])
                job["missing_skills"] = list(job.get("missing_keywords") or [])
                if job.get("match_score") is not None:
                    job["match_score"] = round(float(job["match_score"]), 1)

        return jsonify({
            "success": True,
            "total_count": total_count,
            "count": len(filtered_jobs),
            "jobs": filtered_jobs,
            "matched": resume_matched,
            "filtered": title_keyword is not None or seniority is not None,
        })
    except Exception as e:
        print(f"Error in search_jobs: {e}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e), "total_count": 0, "count": 0, "jobs": []}), 500


@app.route("/api/jobs/stats", methods=["GET"])
def get_stats():
    try:
        all_jobs = jobs_store.query_jobs(days=config.DEFAULT_DAYS_BACK, israel_only=True)
        filtered = filter_jobs(jobs=all_jobs, days=config.DEFAULT_DAYS_BACK, seniority=None, title_keyword=None, debug=False)
        return jsonify({"success": True, "total_jobs": len(filtered), "days_back": config.DEFAULT_DAYS_BACK})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/refresh", methods=["GET", "POST"])
@app.route("/api/jobs/refresh", methods=["GET", "POST"])
def refresh_jobs():
    try:
        scraped = scrape_all_jobs(days=config.DEFAULT_DAYS_BACK, max_comeet_companies=config.COMEET_MAX_BOARDS_FULL_SCAN, skip_comeet=False)
        jobs_store.upsert_jobs(scraped)
        n = jobs_store.count_jobs()
        return jsonify({"success": True, "message": f"Scraped {len(scraped)} jobs; DB has {n} jobs.", "scraped": len(scraped), "total_in_db": n})
    except Exception as e:
        print(f"Refresh error: {e}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == "__main__":
    import os
    debug = os.environ.get("FLASK_DEBUG", "true").lower() in ("1", "true", "yes")
    print("Server: http://localhost:5000")
    app.run(debug=debug, host="0.0.0.0", port=5000, threaded=True)

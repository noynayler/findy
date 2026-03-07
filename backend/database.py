"""Database connection and schema."""

import sqlite3

from backend import config


def get_db_path():
    return config.DB_PATH


def get_connection():
    config.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    return sqlite3.connect(str(config.DB_PATH))


def init_db():
    conn = get_connection()
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                job_id TEXT PRIMARY KEY,
                title TEXT, company TEXT, location TEXT, url TEXT, source TEXT,
                date_posted TEXT NULL, description TEXT,
                first_seen_at TEXT, last_seen_at TEXT, raw_json TEXT NULL
            )
        """)
        conn.commit()
    finally:
        conn.close()

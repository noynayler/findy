"""
WSGI entry for Gunicorn / production hosts.

    gunicorn wsgi:app

Equivalent to: gunicorn backend.app:app
"""

from backend.app import app

__all__ = ["app"]

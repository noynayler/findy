#!/usr/bin/env python
"""Run the Flask app from project root."""
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
os.chdir(ROOT)

from backend.app import app

if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG", "true").lower() in ("1", "true", "yes")
    port = int(os.environ.get("PORT", "5000"))
    print(f"Server: http://0.0.0.0:{port} (debug={debug})")
    app.run(debug=debug, host="0.0.0.0", port=port, threaded=True)

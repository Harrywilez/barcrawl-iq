"""BarCrawl IQ pipeline configuration.

Loads secrets from the repo-root ``.env.local`` (gitignored) via python-dotenv and
exposes them as module constants. Raises a clear error listing any that are missing.

This module never prints or logs secret values — only the application code that uses
them should hold them, and even then they must never be echoed.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# repo root is the parent of the pipeline/ directory that contains this file.
_REPO_ROOT = Path(__file__).resolve().parent.parent

# Secrets live in .env.local (Next.js convention); also load a plain .env if present.
for _env_file in (".env.local", ".env"):
    _candidate = _REPO_ROOT / _env_file
    if _candidate.exists():
        load_dotenv(_candidate)

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

# The Supabase URL is stored as NEXT_PUBLIC_SUPABASE_URL for the web app. The pipeline
# runs server-side and does not care about the NEXT_PUBLIC_ prefix, so accept either.
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")

SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

_REQUIRED = {
    "GOOGLE_MAPS_API_KEY": GOOGLE_MAPS_API_KEY,
    "SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)": SUPABASE_URL,
    "SUPABASE_SERVICE_ROLE_KEY": SUPABASE_SERVICE_ROLE_KEY,
}

_missing = [name for name, value in _REQUIRED.items() if not (value and value.strip())]
if _missing:
    raise RuntimeError(
        "pipeline/config.py: missing required env var(s): "
        + ", ".join(_missing)
        + ". Set them in .env.local at the repo root (see .env.example)."
    )

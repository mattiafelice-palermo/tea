import os
from pathlib import Path
import subprocess
import sys
import traceback

import psycopg

from app.config import settings


ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def log(message: str) -> None:
    print(f"[backend] {message}", flush=True)


def run(command: list[str]) -> None:
    log(f"Running: {' '.join(command)}")
    subprocess.run(command, cwd=ROOT_DIR, check=True)


def check_database() -> None:
    if settings.database_url.startswith("sqlite:///"):
        sqlite_path = Path(settings.database_url.replace("sqlite:///", "", 1))
        sqlite_path.parent.mkdir(parents=True, exist_ok=True)
        log(f"Using local SQLite database: {sqlite_path}")
        return

    connection_url = settings.database_url.replace("postgresql+psycopg://", "postgresql://", 1)
    log(f"Checking database connection: {connection_url}")
    psycopg.connect(connection_url, connect_timeout=3).close()
    log("Database connection OK.")


def main() -> int:
    try:
        log(f"Python executable: {sys.executable}")
        log(f"Working directory: {ROOT_DIR}")
        check_database()
        run([sys.executable, "-m", "alembic", "-c", "backend/alembic.ini", "upgrade", "head"])
        run(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "main:app",
                "--app-dir",
                "backend",
                "--reload",
                "--host",
                "0.0.0.0",
                "--port",
                "8000",
            ]
        )
        return 0
    except Exception:
        log("Backend startup failed.")
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

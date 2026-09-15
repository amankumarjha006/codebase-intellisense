"""
Temporary development runner to start backend (FastAPI/Uvicorn) and frontend (Next.js) simultaneously.

Usage:
    python run_dev.py
"""

import os
import signal
import subprocess
import sys
import time
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
SERVER_DIR = ROOT_DIR / "server"
CLIENT_DIR = ROOT_DIR / "client"

# Resolve python interpreter (prefer server virtual environment)
if sys.platform == "win32":
    venv_python = SERVER_DIR / ".venv" / "Scripts" / "python.exe"
else:
    venv_python = SERVER_DIR / ".venv" / "bin" / "python"

backend_python = str(venv_python) if venv_python.exists() else sys.executable

backend_cmd = [
    backend_python,
    "-m",
    "uvicorn",
    "app.main:app",
    "--reload",
    "--host",
    "127.0.0.1",
    "--port",
    "8000",
]

npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
frontend_cmd = [npm_cmd, "run", "dev"]


def kill_process_tree(proc: subprocess.Popen | None) -> None:
    """Ensure process and any spawned child processes (Node/Uvicorn workers) are killed."""
    if proc is None or proc.poll() is not None:
        return
    pid = proc.pid
    try:
        if sys.platform == "win32":
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(pid)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
        else:
            proc.terminate()
            proc.wait(timeout=3)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass


def main() -> None:
    print("=" * 65)
    print("Starting Codebase Intelligence Local Dev Environment")
    print(f"  Backend:  http://127.0.0.1:8000  (API docs: http://127.0.0.1:8000/docs)")
    print(f"  Frontend: http://localhost:3000")
    print("=" * 65)
    print("Press Ctrl+C to terminate both servers.\n")

    backend_proc: subprocess.Popen | None = None
    frontend_proc: subprocess.Popen | None = None

    try:
        print("[Runner] Starting FastAPI backend on port 8000...")
        backend_proc = subprocess.Popen(
            backend_cmd,
            cwd=str(SERVER_DIR),
        )

        print("[Runner] Starting Next.js frontend on port 3000...")
        frontend_proc = subprocess.Popen(
            frontend_cmd,
            cwd=str(CLIENT_DIR),
            shell=(sys.platform == "win32"),
        )

        while True:
            time.sleep(0.5)
            if backend_proc.poll() is not None:
                print(f"\n[Runner] Backend exited with code {backend_proc.returncode}")
                break
            if frontend_proc.poll() is not None:
                print(f"\n[Runner] Frontend exited with code {frontend_proc.returncode}")
                break

    except KeyboardInterrupt:
        print("\n[Runner] Received Ctrl+C, shutting down...")
    finally:
        print("[Runner] Terminating backend process tree...")
        kill_process_tree(backend_proc)
        print("[Runner] Terminating frontend process tree...")
        kill_process_tree(frontend_proc)
        print("[Runner] Done. Both servers have been stopped.")


if __name__ == "__main__":
    main()

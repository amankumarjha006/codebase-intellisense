"""
Development runner to start FastAPI backend, Next.js frontend, and the background indexing worker.
Explicitly activates server/.venv before starting backend services.

Usage:
    python dev.py             # Starts backend, frontend, and indexing worker (default)
    python dev.py --no-worker # Starts backend and frontend without indexing worker
"""

import argparse
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
SERVER_DIR = ROOT_DIR / "server"
CLIENT_DIR = ROOT_DIR / "client"
VENV_DIR = SERVER_DIR / ".venv"


def get_command_config(subcommand: str):
    """Build the activation command and environment for a server command."""
    env = os.environ.copy()
    
    if sys.platform == "win32":
        scripts_dir = VENV_DIR / "Scripts"
        activate_bat = scripts_dir / "activate.bat"
        
        # Prepend venv Scripts to PATH and set VIRTUAL_ENV
        if scripts_dir.is_dir():
            env["VIRTUAL_ENV"] = str(VENV_DIR)
            env["PATH"] = str(scripts_dir) + os.pathsep + env.get("PATH", "")
            env.pop("PYTHONHOME", None)
            
        if activate_bat.is_file():
            cmd = f'call "{activate_bat}" && {subcommand}'
        else:
            python_exe = scripts_dir / "python.exe" if (scripts_dir / "python.exe").is_file() else Path(sys.executable)
            cmd = f'"{python_exe}" -m {subcommand}'
    else:
        bin_dir = VENV_DIR / "bin"
        activate_sh = bin_dir / "activate"
        
        if bin_dir.is_dir():
            env["VIRTUAL_ENV"] = str(VENV_DIR)
            env["PATH"] = str(bin_dir) + os.pathsep + env.get("PATH", "")
            env.pop("PYTHONHOME", None)
            
        if activate_sh.is_file():
            cmd = f'. "{activate_sh}" && {subcommand}'
        else:
            python_bin = bin_dir / "python" if (bin_dir / "python").is_file() else Path(sys.executable)
            cmd = f'"{python_bin}" -m {subcommand}'

    return cmd, env


def terminate(proc: subprocess.Popen | None) -> None:
    """Kill process and any child processes gracefully or with taskkill."""
    if not proc or proc.poll() is not None:
        return
    try:
        if sys.platform == "win32":
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
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
    parser = argparse.ArgumentParser(description="Codebase Intelligence - Local Development Runner")
    parser.add_argument(
        "--no-worker",
        action="store_true",
        help="Do not start the background indexing worker",
    )
    parser.add_argument(
        "--with-worker",
        action="store_true",
        default=True,
        help="Start the background indexing worker (default: active)",
    )
    args = parser.parse_args()

    start_worker = not args.no_worker

    backend_cmd, backend_env = get_command_config("uvicorn app.main:app --reload --host 127.0.0.1 --port 8000")
    npm_bin = "npm.cmd" if sys.platform == "win32" else "npm"

    print("=" * 65)
    print("  Codebase Intelligence - Local Development Runner")
    print("=" * 65)
    print(f"  Venv Path:    {VENV_DIR}")
    print(f"  Backend API:  http://127.0.0.1:8000  (Docs: http://127.0.0.1:8000/docs)")
    print(f"  Frontend App: http://localhost:3000")
    if start_worker:
        print(f"  Worker:       Background Indexing Worker (active)")
    else:
        print(f"  Worker:       Disabled (--no-worker)")
    print("  Press Ctrl+C to stop all processes")
    print("=" * 65)

    backend_proc = None
    frontend_proc = None
    worker_proc = None

    try:
        # Start Backend
        print("\n[dev] Activating server virtualenv and launching FastAPI...")
        backend_proc = subprocess.Popen(
            backend_cmd,
            cwd=str(SERVER_DIR),
            env=backend_env,
            shell=True,
        )

        # Start Frontend (Vite)
        print("[dev] Launching Vite frontend on port 3000...")
        frontend_cmd = [npm_bin, "run", "dev"]
        frontend_proc = subprocess.Popen(
            frontend_cmd,
            cwd=str(CLIENT_DIR),
            shell=(sys.platform == "win32"),
        )

        # Start Worker
        if start_worker:
            print("[dev] Launching background indexing worker...")
            worker_cmd, worker_env = get_command_config("python -m app.workers.indexing_worker")
            worker_proc = subprocess.Popen(
                worker_cmd,
                cwd=str(SERVER_DIR),
                env=worker_env,
                shell=True,
            )

        # Monitor processes
        while True:
            time.sleep(0.5)
            if backend_proc.poll() is not None:
                print(f"\n[dev] Backend stopped (exit code: {backend_proc.returncode})")
                break
            if frontend_proc.poll() is not None:
                print(f"\n[dev] Frontend stopped (exit code: {frontend_proc.returncode})")
                break
            if worker_proc and worker_proc.poll() is not None:
                print(f"\n[dev] Worker stopped (exit code: {worker_proc.returncode})")
                break

    except KeyboardInterrupt:
        print("\n[dev] Shutting down processes...")
    finally:
        terminate(backend_proc)
        terminate(frontend_proc)
        if worker_proc:
            terminate(worker_proc)
        print("[dev] All processes stopped cleanly.")


if __name__ == "__main__":
    main()

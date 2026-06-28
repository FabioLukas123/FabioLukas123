@echo off
REM Convenience launcher for Windows: create a venv on first run, install deps,
REM then start the tray app from the repo root.
setlocal
set "REPO_DIR=%~dp0.."
cd /d "%REPO_DIR%"

if not exist ".venv\Scripts\python.exe" (
  python -m venv .venv
  ".venv\Scripts\python.exe" -m pip install --upgrade pip
  ".venv\Scripts\python.exe" -m pip install -r requirements.txt
)

REM Use pythonw to avoid a console window.
start "" ".venv\Scripts\pythonw.exe" -m statusbar
endlocal

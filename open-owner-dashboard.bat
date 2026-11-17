@echo off
cd /d "%~dp0"
start "Hair by Sara local server" cmd /k "python -m http.server 4173 --bind 127.0.0.1"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4173/admin/login/"

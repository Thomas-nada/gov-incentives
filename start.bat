@echo off
setlocal
title Cardano Governance Rewards - dev server

set PORT=8000
cd /d "%~dp0"

echo.
echo   Cardano Governance Rewards
echo   --------------------------
echo.

where python >nul 2>&1
if errorlevel 1 (
    echo   Python was not found on PATH. Install Python 3.8 or later and try again.
    echo.
    pause
    exit /b 1
)

echo   Serving %CD% on http://localhost:%PORT%
echo   Close this window to stop the server.
echo.

start "" http://localhost:%PORT%
python dev-server.py --port %PORT%

endlocal

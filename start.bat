@echo off
title Governance Rewards Engine
echo.
echo  =============================================
echo   Governance Rewards Engine - Starting up...
echo  =============================================
echo.

:: Kill any existing server on port 3000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: Start the Python server in a new window
echo  [1/2] Starting server on http://localhost:3000
start "Gov Rewards Server" python -c "import http.server,socketserver,os; os.chdir('E:/govincentives'); h=http.server.SimpleHTTPRequestHandler; h.extensions_map={**h.extensions_map,'.js':'application/javascript','.json':'application/json'}; socketserver.TCPServer(('',3000),h).serve_forever()"

:: Wait for server to be ready
timeout /t 2 /nobreak > nul

:: Open in Chrome
echo  [2/2] Opening in Chrome...
start chrome http://localhost:3000

echo.
echo  Done! The app is running at http://localhost:3000
echo  Close the "Gov Rewards Server" window to stop the server.
echo.

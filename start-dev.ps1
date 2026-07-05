# start-dev.ps1 — launch both dev servers in their OWN terminal windows.
#
# Why: servers started inside a Claude Code session die when that session
# ends. Windows launched by this script are independent — they survive
# Claude Code restarts. Close a window (or Ctrl+C in it) to stop a server.
#
# Usage:  right-click > Run with PowerShell,  or from any terminal:
#         powershell -ExecutionPolicy Bypass -File .\start-dev.ps1

$repo = Split-Path -Parent $MyInvocation.MyCommand.Path

function Test-PortBusy([int]$port) {
    return $null -ne (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
}

# --- Backend: FastAPI on :8000 ---
if (Test-PortBusy 8000) {
    Write-Host "Port 8000 already in use - backend appears to be running. Skipping." -ForegroundColor Yellow
} else {
    Start-Process powershell -ArgumentList @(
        '-NoExit',
        '-Command',
        "`$host.UI.RawUI.WindowTitle = 'greeks-app backend :8000'; Set-Location '$repo\backend'; python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"
    )
    Write-Host "Backend launching on http://127.0.0.1:8000" -ForegroundColor Green
}

# --- Frontend: Next.js on :3000 ---
if (Test-PortBusy 3000) {
    Write-Host "Port 3000 already in use - frontend appears to be running. Skipping." -ForegroundColor Yellow
} else {
    Start-Process powershell -ArgumentList @(
        '-NoExit',
        '-Command',
        "`$host.UI.RawUI.WindowTitle = 'greeks-app frontend :3000'; Set-Location '$repo\frontend'; & 'C:\Program Files\nodejs\npm.cmd' run dev"
    )
    Write-Host "Frontend launching on http://localhost:3000" -ForegroundColor Green
}

Write-Host ""
Write-Host "Both servers run in their own windows and survive Claude Code restarts."
Write-Host "To stop: close the window or press Ctrl+C inside it."

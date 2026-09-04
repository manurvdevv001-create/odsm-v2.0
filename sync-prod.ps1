# ODSM v2 - Production Synchronization Script
# Usage: .\sync-prod.ps1

$Source = "C:\Users\emmanuel\Documents\ODSM\odsm-v2"
$Dest = "C:\Users\emmanuel\Documents\ODSM\odsm-v2-prod"

Write-Host "--- Starting synchronization to Production ---" -ForegroundColor Cyan

# 1. Mirroring files (Excluding node_modules, .next, .git, environment configs, and databases)
Write-Host "[1/4] Syncing files..." -ForegroundColor Yellow
robocopy $Source $Dest /MIR /XD node_modules .next .git .agent .gsd .gemini .gsd-cache tmp /XF dev.db dev.db-shm dev.db-wal tsconfig.tsbuildinfo *.log .env .env.local .env.production

# 2. Installing dependencies
Write-Host "[2/4] Installing dependencies in Prod..." -ForegroundColor Yellow
Set-Location $Dest
npm install

# 3. Generating Prisma Client
Write-Host "[3/4] Generating Prisma Client..." -ForegroundColor Yellow
npx prisma generate

# 4. Building application
Write-Host "[4/4] Building production app..." -ForegroundColor Yellow
npm run build

Write-Host "`n--- Synchronization Complete! ---" -ForegroundColor Green
Write-Host "You can now start the app with: cd '$Dest'; npm run start" -ForegroundColor Cyan

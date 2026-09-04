@echo off
REM ODSM v2 - Production Synchronization Script (Batch version)
set SOURCE=C:\Users\emmanuel\Documents\ODSM\odsm-v2
set DEST=C:\Users\emmanuel\Documents\ODSM\odsm-v2-prod

echo --- Starting synchronization to Production ---

echo [1/4] Syncing files...
robocopy "%SOURCE%" "%DEST%" /MIR /XD node_modules .next .git .agent .gsd .gemini .gsd-cache tmp /XF dev.db dev.db-shm dev.db-wal tsconfig.tsbuildinfo *.log .env .env.local .env.production

echo [2/4] Installing dependencies in Prod...
cd /d "%DEST%"
call npm install

echo [3/4] Generating Prisma Client...
call npx prisma generate

echo [4/4] Building production app...
call npm run build

echo.
echo --- Synchronization Complete! ---
echo You can now start the app with: cd /d "%DEST%" ^&^& npm run start
pause

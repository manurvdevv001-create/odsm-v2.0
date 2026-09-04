# ODSM v2 - Script d'Installation Automatisée
# Ce script prépare l'environnement de production sur la machine du client.

$ErrorActionPreference = "Stop"

Write-Host "--- Début de l'installation de ODSM v2 ---" -ForegroundColor Cyan

# 1. Vérification de l'emplacement
$InstallPath = $PSScriptRoot
Write-Host "Installation dans : $InstallPath" -ForegroundColor Gray
Set-Location $InstallPath

# 2. Vérification des pré-requis (Node.js)
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "ERREUR : Node.js n'est pas installé. Veuillez l'installer avant de continuer." -ForegroundColor Red
    exit 1
}

# 3. Installation des dépendances
Write-Host "[1/4] Installation des dépendances npm..." -ForegroundColor Yellow
npm install --production

# 4. Configuration de la base de données
Write-Host "[2/4] Préparation de la base de données (Prisma)..." -ForegroundColor Yellow
npx prisma generate
# On pousse le schéma si c'est une nouvelle installation
npx prisma db push --accept-data-loss

# 5. Build de l'application Next.js
Write-Host "[3/4] Build de l'application pour la production..." -ForegroundColor Yellow
npm run build

# 6. Création des dossiers de backup par défaut
Write-Host "[4/4] Création des dossiers système..." -ForegroundColor Yellow
if (!(Test-Path "C:\ODSM_Backups")) {
    New-Item -ItemType Directory -Path "C:\ODSM_Backups" -Force
}
if (!(Test-Path "public\uploads")) {
    New-Item -ItemType Directory -Path "public\uploads" -Force
}

Write-Host "`n--- Installation terminée avec succès ! ---" -ForegroundColor Green
Write-Host "Pour lancer l'application : npm run start" -ForegroundColor Cyan

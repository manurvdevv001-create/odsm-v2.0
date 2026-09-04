# ODSM v2 - Script de Sauvegarde 3-2-1
# Sauvegarde : Interne (PC) + Externe (USB) + Cloud (Google Drive)

$ErrorActionPreference = "Continue"

# --- Configuration ---
$AppName = "ODSM_v2"
$Timestamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$InstallPath = $PSScriptRoot
$BackupName = "$($AppName)_Backup_$($Timestamp).zip"
$InternalBackupPath = "C:\ODSM_Backups"
$USBDirName = "ODSM_USB_BACKUP"
$TempPath = Join-Path $env:TEMP "ODSM_Temp_Backup"

Write-Host "--- Lancement de la Sauvegarde ODSM v2 ---" -ForegroundColor Cyan

# Nettoyage temp
if (Test-Path $TempPath) { Remove-Item -Recurse -Force $TempPath }
New-Item -ItemType Directory -Path $TempPath

# 1. Snapshot SQLite (Zéro corruption)
Write-Host "[1/4] Snapshot de la base de données..." -ForegroundColor Yellow
if (Test-Path "$InstallPath\dev.db") {
    sqlite3 "$InstallPath\dev.db" ".backup '$TempPath\dev.db'"
} else {
    Write-Host "AVERTISSEMENT : Base de données dev.db introuvable." -ForegroundColor Red
}

# 2. Archivage (DB + Uploads + .env)
Write-Host "[2/4] Création de l'archive ZIP..." -ForegroundColor Yellow
$FilesToZip = @()
if (Test-Path "$TempPath\dev.db") { $FilesToZip += "$TempPath\dev.db" }
if (Test-Path "$InstallPath\public\uploads") { $FilesToZip += "$InstallPath\public\uploads" }
if (Test-Path "$InstallPath\.env") { $FilesToZip += "$InstallPath\.env" }

Compress-Archive -Path $FilesToZip -DestinationPath "$TempPath\$BackupName" -Force

# 3. Distribution 3-2-1

# A. Sauvegarde INTERNE
Write-Host "[3/4] Copie Interne ($InternalBackupPath)..." -ForegroundColor Yellow
if (!(Test-Path $InternalBackupPath)) { New-Item -ItemType Directory -Path $InternalBackupPath }
Copy-Item "$TempPath\$BackupName" "$InternalBackupPath\$BackupName"

# B. Sauvegarde EXTERNE (USB Auto-détection)
Write-Host "[3/4] Recherche d'une clé USB (Dossier $USBDirName)..." -ForegroundColor Yellow
$USBFound = $false
$Drives = Get-CimInstance Win32_Volume | Where-Object { $_.DriveType -eq 2 -and $_.DriveLetter -ne $null }
foreach ($Drive in $Drives) {
    $USBPath = Join-Path $Drive.DriveLetter $USBDirName
    if (Test-Path $USBPath) {
        Write-Host "Clé USB détectée sur $($Drive.DriveLetter). Copie en cours..." -ForegroundColor Green
        Copy-Item "$TempPath\$BackupName" "$USBPath\$BackupName"
        $USBFound = $true
        break
    }
}
if (!$USBFound) { Write-Host "INFO : Aucune clé USB configurée n'a été trouvée." -ForegroundColor Gray }

# C. Sauvegarde CLOUD (Si configuré)
# Pour Google Drive, on cherche le dossier synchronisé de l'utilisateur
$GDrivePath = Join-Path $env:USERPROFILE "Google Drive\Mon Drive\ODSM_Backups"
if (Test-Path $GDrivePath) {
    Write-Host "[3/4] Synchronisation Cloud détectée. Copie..." -ForegroundColor Green
    Copy-Item "$TempPath\$BackupName" "$GDrivePath\$BackupName"
} else {
    Write-Host "INFO : Dossier Cloud Google Drive non détecté." -ForegroundColor Gray
}

# 4. Nettoyage
Remove-Item -Recurse -Force $TempPath
Write-Host "`n--- Sauvegarde terminée ! ---" -ForegroundColor Green
Write-Host "Archive : $BackupName" -ForegroundColor Cyan

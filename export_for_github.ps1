<#
export_for_github.ps1

Usage:
  PowerShell -ExecutionPolicy Bypass -File .\export_for_github.ps1 -Destination "C:\path\to\odsm-prod-github"
  or
  .\export_for_github.ps1 -Destination "C:\path\to\odsm-prod-github"

Description:
  Copie une sélection de fichiers et dossiers (définis ci-dessous) depuis le repo courant
  vers le dossier Destination tout en préservant l'arborescence. N'efface pas les originaux.

  Par défaut Destination = <repo-root>\odsm-prod-github

#>
[CmdletBinding()]
param(
    [string]
    $Destination = "$PSScriptRoot\odsm-prod-github",

    [switch]
    $VerboseCopy
)

$ErrorActionPreference = 'Stop'
$SourceRoot = $PSScriptRoot
Write-Host "Source root:" $SourceRoot
Write-Host "Destination:" $Destination

# Liste explicite des fichiers/dossiers à copier (chemins relatifs au repo)
$Include = @(
    '.gitignore',
    'README.md',
    'LICENSE',
    'CHANGELOG.md',
    'VERSION',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'next-env.d.ts',
    'next.config.ts',
    'postcss.config.mjs',
    'eslint.config.mjs',
    'prisma.config.ts',
    '.env.example',

    # Dossiers
    'prisma',
    'src',
    'public',
    'assets',
    'scripts',
    'adapters',
    'android',
    'mobile',
    'promotion_marketing',
    'docs',

    # Optional top-level files / scripts
    'sync-prod.bat',
    'sync-prod.ps1',
    'capacitor.config.ts',
    'components.json'
)

# Patterns/names to exclude within copied trees
$ExcludeNamePatterns = @(
    'node_modules',
    '.git',
    '.next',
    'tmp',
    'log.txt',
    'tsconfig.tsbuildinfo'
)
# Wildcard filename patterns
$ExcludeFilePatterns = @(
    '*.db',
    '*.db-shm',
    '*.db-wal',
    '*.zip',
    '*.log',
    '*.docx',
    '*.pdf'
)

function Ensure-Dir([string]$path) {
    if (-not (Test-Path -Path $path)) {
        New-Item -ItemType Directory -Path $path -Force | Out-Null
    }
}

function Should-SkipFile([string]$fullPath, [string]$sourceRoot) {
    $rel = $fullPath.Substring($sourceRoot.Length).TrimStart('\')
    $parts = $rel -split '\\'

    foreach ($p in $ExcludeNamePatterns) {
        if ($parts -contains $p) { return $true }
    }
    foreach ($pat in $ExcludeFilePatterns) {
        if ([IO.Path]::GetFileName($fullPath) -like $pat) { return $true }
    }
    return $false
}

function Copy-Directory-Selective([string]$srcDir, [string]$destDir) {
    if (-not (Test-Path -Path $srcDir)) {
        Write-Verbose "Source directory not found: $srcDir"
        return
    }
    $files = Get-ChildItem -Path $srcDir -Recurse -File -ErrorAction SilentlyContinue
    foreach ($f in $files) {
        if (Should-SkipFile $f.FullName $srcDir) { continue }
        # Compute relative path from srcDir
        $relative = $f.FullName.Substring($srcDir.Length).TrimStart('\')
        $targetPath = Join-Path $destDir $relative
        $targetDir = Split-Path $targetPath -Parent
        Ensure-Dir $targetDir
        Copy-Item -Path $f.FullName -Destination $targetPath -Force
        if ($VerboseCopy) { Write-Host "Copied file: $relative" }
    }
}

function Copy-File([string]$srcFile, [string]$destRoot) {
    $src = Join-Path $SourceRoot $srcFile
    if (-not (Test-Path -Path $src -PathType Leaf)) { Write-Verbose "File not found: $srcFile"; return }
    $destPath = Join-Path $destRoot $srcFile
    $destDir = Split-Path $destPath -Parent
    Ensure-Dir $destDir
    Copy-Item -Path $src -Destination $destPath -Force
    if ($VerboseCopy) { Write-Host "Copied file: $srcFile" }
}

# Create destination root
Ensure-Dir $Destination

foreach ($item in $Include) {
    $srcPath = Join-Path $SourceRoot $item
    if (Test-Path -Path $srcPath -PathType Container) {
        Write-Host "Copying folder: $item"
        $destFolder = Join-Path $Destination $item
        Ensure-Dir $destFolder
        Copy-Directory-Selective -srcDir $srcPath -destDir $destFolder
    }
    elseif (Test-Path -Path $srcPath -PathType Leaf) {
        Write-Host "Copying file: $item"
        Copy-File -srcFile $item -destRoot $Destination
    }
    else {
        Write-Host "Skipping (not found): $item"
    }
}

Write-Host "\nExport complete. Destination: $Destination"
Write-Host "Vérifier le dossier et init un dépôt git si nécessaire. (.env et dev.db ne sont PAS copiés)"

# Create README-SETUP.md in the destination with setup instructions
$readmePath = Join-Path $Destination 'README-SETUP.md'
$readmeContent = @"
README-SETUP.md - Setup & restore instructions

This folder was exported from the odsm-v2 repository to be used as a GitHub-ready backup.

Quick start (Windows, PowerShell):

1. Clone or copy this folder to the target machine:
   git clone <your-github-repo-url> destination-folder
   or copy the folder files directly.

2. Prepare environment variables:
   Copy .env.example to .env and edit values:
     copy .env.example .env
   Edit .env and set:
     - DATABASE_URL (default: file:./dev.db for local SQLite)
     - ENCRYPTION_KEY (set a secure 32-char key)
     - NODE_ENV=development

   Note: Do NOT commit .env to GitHub. For production use a managed secret store.

3. Install dependencies:
   npm ci

4. Generate Prisma client and apply schema:
   npx prisma generate
   npx prisma db push

5. Start the app:
   - Development: npm run dev
   - Production: npm run build && npm run start

6. If you need the local SQLite DB file (dev.db), create it by running prisma db push or by restoring from a secure backup.

Additional notes:
- node_modules, .env, dev.db, and build artifacts are intentionally excluded.
- For mobile builds, ensure Android SDK and Capacitor tools are installed; add google-services.json manually if using Firebase.
- For remote access via Cloudflare Tunnel, configure the tunnel outside this repo and ensure appropriate env vars are set.

"@
Set-Content -Path $readmePath -Value $readmeContent -Encoding UTF8
Write-Host "README-SETUP.md created at $readmePath"


# Bundle the Spring Boot fat jar and a trimmed JRE into Tauri resources so the
# desktop shell can launch the backend by itself.
#
# Usage (run from ai-ssh-client):
#   npm run backend:bundle              # maven package + jlink JRE
#   npm run backend:bundle -- -SkipJre  # reuse existing JRE, refresh jar only
#
# Outputs:
#   src-tauri/resources/backend/ai-ssh-server-app.jar
#   src-tauri/resources/jre/bin/java.exe
#
# Notes:
#   - jar/JRE are large build artifacts and are git-ignored (see resources/.gitignore).
#   - Keep this file ASCII-only: npm runs it with Windows PowerShell 5.1, which
#     reads a BOM-less script as ANSI/GBK; non-ASCII text would break parsing.
#   - The frontend `beforeBuildCommand` in tauri.conf.json runs this script, so
#     `npm run tauri build` always ships a fresh backend.

param(
    [switch]$SkipJre
)

$ErrorActionPreference = "Stop"

$clientRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $clientRoot
$serverRoot = Join-Path $repoRoot "ai-ssh-server"
$resources = Join-Path $clientRoot "src-tauri\resources"
$backendDir = Join-Path $resources "backend"
$jreDir = Join-Path $resources "jre"
$jarSource = Join-Path $serverRoot "ai-ssh-server-app\target\ai-ssh-server-app.jar"
$jarTarget = Join-Path $backendDir "ai-ssh-server-app.jar"

Write-Host "==> Building backend jar ..." -ForegroundColor Cyan
Push-Location $serverRoot
try {
    & mvn -q -pl ai-ssh-server-app -am -DskipTests package
    if ($LASTEXITCODE -ne 0) {
        throw "Maven build failed (exit $LASTEXITCODE)"
    }
} finally {
    Pop-Location
}

if (-not (Test-Path $jarSource)) {
    throw "Jar not found: $jarSource"
}

New-Item -ItemType Directory -Force -Path $backendDir | Out-Null
Copy-Item -Force $jarSource $jarTarget
Write-Host ("    jar: {0:N1} MB -> {1}" -f ((Get-Item $jarTarget).Length / 1MB), $jarTarget) -ForegroundColor Green

if (-not $SkipJre) {
    Write-Host "==> Generating trimmed JRE with jlink ..." -ForegroundColor Cyan

    $javaExe = $null
    if ($env:JAVA_HOME) {
        $candidate = Join-Path $env:JAVA_HOME "bin\java.exe"
        if (Test-Path $candidate) { $javaExe = $candidate }
    }
    if (-not $javaExe) {
        $javaExe = (Get-Command java -ErrorAction Stop).Source
    }
    $javaHome = Split-Path -Parent (Split-Path -Parent $javaExe)
    $jlink = Join-Path $javaHome "bin\jlink.exe"
    if (-not (Test-Path $jlink)) {
        throw "jlink not found: $jlink (a full JDK 17 is required, not just a JRE)"
    }

    if (Test-Path $jreDir) {
        Remove-Item -Recurse -Force $jreDir
    }
    # ALL-MODULE-PATH: Spring Boot / ADK rely heavily on reflection, so whitelisting
    # modules is fragile. All modules + strip + compress is ~70-90 MB and "always runs".
    & $jlink --add-modules ALL-MODULE-PATH `
        --strip-debug --no-header-files --no-man-pages `
        --compress=2 --output $jreDir
    if ($LASTEXITCODE -ne 0) {
        throw "jlink failed (exit $LASTEXITCODE)"
    }
    $javaTarget = Join-Path $jreDir "bin\java.exe"
    if (-not (Test-Path $javaTarget)) {
        throw "Generated JRE is missing java.exe: $javaTarget"
    }
    Write-Host ("    JRE -> {0}" -f $jreDir) -ForegroundColor Green
}

Write-Host ""
Write-Host "Backend resources are ready. Next:" -ForegroundColor Cyan
Write-Host "  npm run tauri build                 # build installer"
Write-Host "  npm run tauri build -- --no-bundle  # compile executable only"

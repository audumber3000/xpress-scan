<#
.SYNOPSIS
  Packages the Tauri-built MolarPlus.exe into an MSIX for Microsoft Store
  submission. Runs only on Windows; called from desktop-release.yml CI.

.DESCRIPTION
  Tauri v2 does not natively output MSIX. This script wraps the raw Win32
  exe (already produced by `tauri build`) into an MSIX using makeappx.exe
  from the Windows SDK. Steps:

    1. Read version from tauri.conf.json (zero-padded to MSIX's 4-part form).
    2. Stage MolarPlus.exe + any sibling DLLs into a temp folder.
    3. Render AppxManifest.xml with that version into the staging folder.
    4. Generate the seven required Store asset PNGs from icons/icon.png
       using System.Drawing.
    5. Locate makeappx.exe in the Windows SDK and pack the staging folder
       into MolarPlus.msix.

  The resulting MSIX is UNSIGNED — Microsoft signs it at submission time
  when distributed via the Store. Do NOT distribute this MSIX directly
  (e.g. R2 download) without signing first, since Windows won't install
  an unsigned MSIX without sideloading + a trusted cert.
#>

[CmdletBinding()]
param(
    [string]$DesktopRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
    [string]$OutputPath = ''
)

$ErrorActionPreference = 'Stop'

function Get-TauriVersion {
    param([string]$ConfPath)
    $json = Get-Content -Raw -Path $ConfPath | ConvertFrom-Json
    $v = $json.version
    if (-not $v) { throw "version not found in $ConfPath" }
    # MSIX requires 4-part version. Pad with .0 as needed.
    $parts = @($v -split '\.')
    while ($parts.Count -lt 4) { $parts += '0' }
    return ($parts[0..3] -join '.')
}

function Find-MakeAppx {
    $sdkRoot = "${env:ProgramFiles(x86)}\Windows Kits\10\bin"
    if (-not (Test-Path $sdkRoot)) {
        throw "Windows SDK not found at $sdkRoot — install the Windows 10/11 SDK on this runner."
    }
    # Prefer the newest installed SDK version; pick the x64 makeappx.
    $candidate = Get-ChildItem -Path $sdkRoot -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^\d+\.\d+\.\d+\.\d+$' } |
        Sort-Object { [version]$_.Name } -Descending |
        ForEach-Object { Join-Path $_.FullName 'x64\makeappx.exe' } |
        Where-Object { Test-Path $_ } |
        Select-Object -First 1
    if (-not $candidate) {
        throw "makeappx.exe not found under $sdkRoot — Windows SDK install is incomplete."
    }
    return $candidate
}

function New-AssetPng {
    param(
        [string]$SourceIconPath,
        [string]$DestPath,
        [int]$Width,
        [int]$Height,
        [string]$BackgroundHex = ''
    )
    Add-Type -AssemblyName System.Drawing
    $src = [System.Drawing.Image]::FromFile($SourceIconPath)
    try {
        $bmp = New-Object System.Drawing.Bitmap $Width, $Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        try {
            $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
            $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            if ($BackgroundHex) {
                $r = [Convert]::ToInt32($BackgroundHex.Substring(1,2),16)
                $gg = [Convert]::ToInt32($BackgroundHex.Substring(3,2),16)
                $b = [Convert]::ToInt32($BackgroundHex.Substring(5,2),16)
                $g.Clear([System.Drawing.Color]::FromArgb(255, $r, $gg, $b))
            } else {
                $g.Clear([System.Drawing.Color]::Transparent)
            }

            # Fit the square source icon centered inside the target rect with ~20% padding.
            $longSide = [Math]::Min($Width, $Height)
            $iconSide = [int]([Math]::Round($longSide * 0.8))
            $x = [int](($Width - $iconSide) / 2)
            $y = [int](($Height - $iconSide) / 2)
            $g.DrawImage($src, $x, $y, $iconSide, $iconSide)
        } finally {
            $g.Dispose()
        }
        $bmp.Save($DestPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
    } finally {
        $src.Dispose()
    }
}

# ──────────────────────────────────────────────────────────────────────────────
# Resolve paths and read version
# ──────────────────────────────────────────────────────────────────────────────
$desktopRootFull = (Resolve-Path $DesktopRoot).Path
$tauriRoot       = Join-Path $desktopRootFull 'src-tauri'
$confPath        = Join-Path $tauriRoot 'tauri.conf.json'
$manifestSrc     = Join-Path $tauriRoot 'msix\AppxManifest.xml'
$iconSource      = Join-Path $tauriRoot 'icons\icon.png'
$releaseDir      = Join-Path $tauriRoot 'target\release'

foreach ($p in @($confPath, $manifestSrc, $iconSource)) {
    if (-not (Test-Path $p)) { throw "Required input missing: $p" }
}

# Tauri's cargo binary name comes from Cargo.toml's [package].name ("molarplus-desktop"),
# not from tauri.conf.json's productName. The bundle step renames it to MolarPlus.exe
# inside the MSI, but the raw cargo output keeps the cargo name. Search both names.
$exeCandidates = @(
    'molarplus-desktop.exe',
    'molarplus_desktop.exe',
    'MolarPlus.exe'
) | ForEach-Object { Join-Path $releaseDir $_ }

$exePath = $exeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $exePath) {
    Write-Host "ERROR: MolarPlus exe not found. Checked:" -ForegroundColor Red
    $exeCandidates | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    if (Test-Path $releaseDir) {
        Write-Host "Contents of $releaseDir`:" -ForegroundColor Yellow
        Get-ChildItem -Path $releaseDir -File | ForEach-Object {
            Write-Host "  $($_.Name)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "Release directory does not exist: $releaseDir" -ForegroundColor Red
    }
    throw "MolarPlus exe not found in $releaseDir"
}
Write-Host "Found exe: $exePath"

$version = Get-TauriVersion -ConfPath $confPath
Write-Host "MSIX version: $version"

if (-not $OutputPath) {
    $OutputPath = Join-Path $tauriRoot "target\release\bundle\msix\MolarPlus_${version}_x64.msix"
}
$outDir = Split-Path -Parent $OutputPath
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }

# ──────────────────────────────────────────────────────────────────────────────
# Stage payload
# ──────────────────────────────────────────────────────────────────────────────
$staging = Join-Path $env:RUNNER_TEMP "msix-staging-$([guid]::NewGuid())"
if (-not $env:RUNNER_TEMP) {
    $staging = Join-Path $env:TEMP "msix-staging-$([guid]::NewGuid())"
}
New-Item -ItemType Directory -Force -Path $staging | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $staging 'Assets') | Out-Null
Write-Host "Staging at: $staging"

# Copy MolarPlus.exe and any top-level DLLs Tauri may have emitted alongside it.
Copy-Item -Path $exePath -Destination (Join-Path $staging 'MolarPlus.exe')
Get-ChildItem -Path (Split-Path -Parent $exePath) -Filter *.dll -File -ErrorAction SilentlyContinue |
    ForEach-Object { Copy-Item -Path $_.FullName -Destination (Join-Path $staging $_.Name) }

# Render AppxManifest.xml with the resolved version.
$manifestText = Get-Content -Raw -Path $manifestSrc
$manifestText = $manifestText -replace 'Version="0\.0\.0\.0"', "Version=`"$version`""
Set-Content -Path (Join-Path $staging 'AppxManifest.xml') -Value $manifestText -Encoding UTF8

# Generate the Microsoft Store asset PNG set from the master icon.
# Sizes per https://learn.microsoft.com/windows/apps/design/style/iconography/app-icon-construction
$assetsDir = Join-Path $staging 'Assets'
$assets = @(
    @{ Name = 'Square44x44Logo.png';  W =  44; H =  44 },
    @{ Name = 'Square71x71Logo.png';  W =  71; H =  71 },
    @{ Name = 'Square150x150Logo.png';W = 150; H = 150 },
    @{ Name = 'Square310x310Logo.png';W = 310; H = 310 },
    @{ Name = 'Wide310x150Logo.png';  W = 310; H = 150 },
    @{ Name = 'StoreLogo.png';        W =  50; H =  50 },
    @{ Name = 'SplashScreen.png';     W = 620; H = 300; Bg = '#FFFFFF' }
)
foreach ($a in $assets) {
    $dest = Join-Path $assetsDir $a.Name
    $bg = if ($a.ContainsKey('Bg')) { $a.Bg } else { '' }
    New-AssetPng -SourceIconPath $iconSource -DestPath $dest -Width $a.W -Height $a.H -BackgroundHex $bg
    Write-Host "  asset: $($a.Name) ($($a.W)x$($a.H))"
}

# ──────────────────────────────────────────────────────────────────────────────
# Pack
# ──────────────────────────────────────────────────────────────────────────────
$makeappx = Find-MakeAppx
Write-Host "Using makeappx: $makeappx"

if (Test-Path $OutputPath) { Remove-Item -Force $OutputPath }
& $makeappx pack /o /d $staging /p $OutputPath
if ($LASTEXITCODE -ne 0) { throw "makeappx pack failed with exit code $LASTEXITCODE" }

Write-Host "MSIX written to: $OutputPath"
Write-Output $OutputPath

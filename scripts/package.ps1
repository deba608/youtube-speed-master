# Packages the extension for the Chrome Web Store.
# Produces dist/youtube-speed-master-<version>.zip with manifest.json at the zip root.
# Usage: npm run package

[CmdletBinding()]
param(
  [string]$OutDir
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content (Join-Path $root 'manifest.json') -Raw | ConvertFrom-Json
$version = $manifest.version

if ([string]::IsNullOrWhiteSpace($OutDir)) {
  $OutDir = Join-Path $root 'dist'
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$zipPath = Join-Path $OutDir ("youtube-speed-master-{0}.zip" -f $version)
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

$stage = Join-Path ([System.IO.Path]::GetTempPath()) ("ytsm-package-" + [System.Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage | Out-Null

try {
  Copy-Item (Join-Path $root 'manifest.json') $stage
  Copy-Item (Join-Path $root 'src') $stage -Recurse
  Copy-Item (Join-Path $root 'icons') $stage -Recurse

  Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zipPath -CompressionLevel Optimal

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
  try {
    $entries = @($archive.Entries | ForEach-Object { $_.FullName })
  } finally {
    $archive.Dispose()
  }

  $required = @(
    'manifest.json',
    'src/content.js',
    'src/overlay.css',
    'src/popup.html',
    'src/popup.js',
    'src/popup.css',
    'icons/icon16.png',
    'icons/icon32.png',
    'icons/icon48.png',
    'icons/icon128.png'
  )
  $missing = @($required | Where-Object { $entries -notcontains $_ })
  if ($missing.Count -gt 0) {
    throw ("missing from zip: " + ($missing -join ', '))
  }

  Write-Host ("wrote {0} ({1:N0} bytes, {2} entries)" -f $zipPath, (Get-Item $zipPath).Length, $entries.Count)
  foreach ($entry in $entries) { Write-Host "  $entry" }
} finally {
  if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
}

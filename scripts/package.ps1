# Packages the extension for the Chrome Web Store.
# Produces dist/youtube-speed-master-<version>.zip with manifest.json at the zip root
# and forward-slash entry names (Compress-Archive writes backslashes on Windows).
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

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$files = @(
  Get-Item (Join-Path $root 'manifest.json')
  Get-ChildItem (Join-Path $root 'src') -File -Recurse
  Get-ChildItem (Join-Path $root 'icons') -File -Recurse
)

$archive = [System.IO.Compression.ZipFile]::Open($zipPath, 'Create')
try {
  foreach ($file in $files) {
    $relative = $file.FullName.Substring($root.Length + 1).Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $archive,
      $file.FullName,
      $relative,
      [System.IO.Compression.CompressionLevel]::Optimal
    ) | Out-Null
  }
} finally {
  $archive.Dispose()
}

$read = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  $entries = @($read.Entries | ForEach-Object { $_.FullName })
} finally {
  $read.Dispose()
}

$required = @(
  'manifest.json',
  'src/content.js',
  'src/overlay.css',
  'src/popup.html',
  'src/popup.js',
  'src/popup.css',
  'src/options.html',
  'src/options.js',
  'src/options.css',
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

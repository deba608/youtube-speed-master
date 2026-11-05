# Generates the 16/32/48/128 px extension icons: a neutral speedometer gauge.
# Usage: powershell -ExecutionPolicy Bypass -File .\scripts\make-icons.ps1

[CmdletBinding()]
param(
  [string]$OutDir
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

if ([string]::IsNullOrWhiteSpace($OutDir)) {
  $OutDir = Join-Path $PSScriptRoot '..\icons'
}
$OutDir = [System.IO.Path]::GetFullPath($OutDir)
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

function New-RoundedRectPath {
  param([single]$X, [single]$Y, [single]$W, [single]$H, [single]$R)

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = [single]($R * 2)
  $path.AddArc($X, $Y, $d, $d, 180, 90)
  $path.AddArc($X + $W - $d, $Y, $d, $d, 270, 90)
  $path.AddArc($X + $W - $d, $Y + $H - $d, $d, $d, 0, 90)
  $path.AddArc($X, $Y + $H - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

$sizes = 16, 32, 48, 128

foreach ($size in $sizes) {
  $bmp = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)

  # Rounded background with a subtle diagonal gradient.
  $pad = [single]0.5
  $inner = [single]($size - 2 * $pad)
  $bgRect = [System.Drawing.RectangleF]::new($pad, $pad, $inner, $inner)
  $bgPath = New-RoundedRectPath -X $bgRect.X -Y $bgRect.Y -W $bgRect.Width -H $bgRect.Height -R ([single]($size * 0.22))
  $bgBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $bgRect,
    [System.Drawing.Color]::FromArgb(255, 13, 20, 33),
    [System.Drawing.Color]::FromArgb(255, 30, 43, 61),
    [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal
  )
  $g.FillPath($bgBrush, $bgPath)

  # Gauge geometry.
  $cx = [single]($size / 2)
  $cy = [single]($size * 0.54)
  $arcSize = [single]($size * 0.64)
  $arcRect = [System.Drawing.RectangleF]::new([single]($cx - $arcSize / 2), [single]($cy - $arcSize / 2), $arcSize, $arcSize)
  $stroke = [single][Math]::Max(1.4, $size * 0.075)

  $trackPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 45, 58, 78), $stroke)
  $trackPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $trackPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawArc($trackPen, $arcRect, 135, 270)

  $accentPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 45, 212, 191), $stroke)
  $accentPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $accentPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawArc($accentPen, $arcRect, 135, 162)

  # Tick marks (skip on the smallest sizes so they do not turn into mush).
  if ($size -ge 32) {
    $tickWidth = [single][Math]::Max(1, $size * 0.018)
    $tickPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(170, 148, 163, 184), $tickWidth)
    $rOuter = [single]($arcSize / 2 + $stroke * 0.8)
    $rInner = [single]($arcSize / 2 + $stroke * 0.15)
    foreach ($i in 0..8) {
      $deg = 135 + (270 * $i / 8)
      $rad = $deg * [Math]::PI / 180
      $x1 = $cx + [single]([Math]::Cos($rad) * $rInner)
      $y1 = $cy + [single]([Math]::Sin($rad) * $rInner)
      $x2 = $cx + [single]([Math]::Cos($rad) * $rOuter)
      $y2 = $cy + [single]([Math]::Sin($rad) * $rOuter)
      $g.DrawLine($tickPen, $x1, $y1, $x2, $y2)
    }
  }

  # Needle pointing at the "fast" side of the dial.
  $needleDeg = 135 + 162
  $needleRad = $needleDeg * [Math]::PI / 180
  $needleLen = [single]($size * 0.24)
  $needleWidth = [single][Math]::Max(1.5, $size * 0.055)
  $needlePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 248, 250, 252), $needleWidth)
  $needlePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $needlePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawLine(
    $needlePen,
    $cx,
    $cy,
    ($cx + [single]([Math]::Cos($needleRad) * $needleLen)),
    ($cy + [single]([Math]::Sin($needleRad) * $needleLen))
  )

  # Hub.
  $hubR = [single][Math]::Max(1.2, $size * 0.06)
  $hubBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 45, 212, 191))
  $g.FillEllipse($hubBrush, ($cx - $hubR), ($cy - $hubR), ($hubR * 2), ($hubR * 2))

  $file = Join-Path $OutDir ("icon{0}.png" -f $size)
  $bmp.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)

  foreach ($resource in @($hubBrush, $needlePen, $tickPen, $accentPen, $trackPen, $bgBrush, $bgPath, $g, $bmp)) {
    if ($null -ne $resource) { $resource.Dispose() }
  }

  Write-Host ("wrote {0}" -f $file)
}

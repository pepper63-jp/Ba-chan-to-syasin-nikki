Add-Type -AssemblyName System.Drawing

$srcPath = Join-Path $PSScriptRoot "..\\icon-512.png"
$out512 = Join-Path $PSScriptRoot "..\\icon-512.png"
$out192 = Join-Path $PSScriptRoot "..\\icon-192.png"
$tmp512 = Join-Path $PSScriptRoot "..\\icon-512.tmp.png"
$tmp192 = Join-Path $PSScriptRoot "..\\icon-192.tmp.png"

$img = [System.Drawing.Bitmap]::FromFile($srcPath)
try {
  $minX = $img.Width
  $minY = $img.Height
  $maxX = -1
  $maxY = -1

  # icon-512.png is currently a screenshot-like asset with a checkerboard baked in,
  # so we detect the colored icon area by "not-gray" pixels rather than alpha.
  for ($y = 0; $y -lt $img.Height; $y++) {
    for ($x = 0; $x -lt $img.Width; $x++) {
      $p = $img.GetPixel($x, $y)
      $r = [int]$p.R
      $g = [int]$p.G
      $b = [int]$p.B
      $max = [Math]::Max($r, [Math]::Max($g, $b))
      $min = [Math]::Min($r, [Math]::Min($g, $b))

      # Gray background squares have max-min ~= 0. The pink icon area is saturated.
      if (($max - $min) -gt 25) {
        if ($x -lt $minX) { $minX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }

  if ($maxX -lt 0) {
    throw "No non-transparent pixels found in $srcPath"
  }

  $rect = New-Object System.Drawing.Rectangle($minX, $minY, ($maxX - $minX + 1), ($maxY - $minY + 1))
  $cropped = $img.Clone($rect, $img.PixelFormat)
  try {
    foreach ($size in @(512, 192)) {
      $dest = New-Object System.Drawing.Bitmap($size, $size)
      $g = [System.Drawing.Graphics]::FromImage($dest)
      try {
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.DrawImage($cropped, 0, 0, $size, $size)

        $outPath = if ($size -eq 512) { $tmp512 } else { $tmp192 }
        $dest.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
      }
      finally {
        $g.Dispose()
        $dest.Dispose()
      }
    }
  }
  finally {
    $cropped.Dispose()
  }

  Write-Output ("Trimmed bbox: ({0},{1})-({2},{3})" -f $minX, $minY, $maxX, $maxY)
}
finally {
  $img.Dispose()
}

Move-Item -Force $tmp512 $out512
Move-Item -Force $tmp192 $out192


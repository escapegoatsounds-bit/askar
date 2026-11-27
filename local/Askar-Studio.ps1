# Askar Studio (local): starts the local Askar server if it isn't running,
# then opens Askar (from this PC) and the Land of Rebirth Desk side by side.
# The server keeps running quietly in the background; it only answers this PC.

$ErrorActionPreference = 'Stop'
$repo  = Split-Path -Parent $PSScriptRoot
$port  = 5173
$askar = "http://localhost:$port/"
$desk  = "http://localhost:$port/desk/"   # the Desk on this PC (online backup copy: https://claude.ai/artifact/Ae7qJiZFX6M5SD3ZNQf33S)
$logDir = Join-Path $env:USERPROFILE 'Documents\Land of Rebirth Data\logs'
New-Item -ItemType Directory -Force $logDir | Out-Null

Add-Type -AssemblyName System.Windows.Forms, System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

# The server may listen on IPv6 (::1) or IPv4 (127.0.0.1) depending on Node; check both.
function Test-Port {
  foreach ($addr in @([Net.IPAddress]::IPv6Loopback, [Net.IPAddress]::Loopback)) {
    $c = New-Object Net.Sockets.TcpClient($addr.AddressFamily)
    try { $c.Connect($addr, $port); return $true } catch { } finally { $c.Close() }
  }
  return $false
}
# Message boxes are owned by a topmost window so they can't hide behind other apps.
function Show-Message($text) {
  $owner = New-Object System.Windows.Forms.Form -Property @{ TopMost = $true }
  [System.Windows.Forms.MessageBox]::Show($owner, $text, 'Askar Studio') | Out-Null
  $owner.Dispose()
}
$dot = [char]0x00B7   # middle dot, written as a code so file encoding can't garble it
trap {
  "$(Get-Date -Format s)  $_`n$($_.ScriptStackTrace)" | Out-File -Append -Encoding utf8 (Join-Path $logDir 'launcher-errors.log')
  Show-Message "Askar Studio hit a problem:`n$_`n`nDetails: $logDir\launcher-errors.log"
  exit 1
}

# Loading screen: the round Land of Rebirth logo, until the server answers (or 40 s pass).
function Show-Splash {
  $img = [System.Drawing.Image]::FromFile((Join-Path $repo 'public\land-of-rebirth-logo.png'))
  # Background = the logo's own dark rim, so the circle blends into the window.
  $bg = ([System.Drawing.Bitmap]$img).GetPixel([int]($img.Width * 0.06), [int]($img.Height / 2))
  $gold = [System.Drawing.Color]::FromArgb(214, 172, 92)
  $size = 360

  $f = New-Object System.Windows.Forms.Form
  $f.FormBorderStyle = 'None'; $f.StartPosition = 'CenterScreen'; $f.Size = New-Object System.Drawing.Size(420, 450)
  $f.BackColor = $bg; $f.TopMost = $true; $f.ShowInTaskbar = $true; $f.Text = 'Askar Studio'
  $f.Icon = New-Object System.Drawing.Icon (Join-Path $repo 'public\askar-studio.ico')
  # Rounded window corners
  $r = 28; $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
  $gp.AddArc(0, 0, $r, $r, 180, 90); $gp.AddArc($f.Width - $r, 0, $r, $r, 270, 90)
  $gp.AddArc($f.Width - $r, $f.Height - $r, $r, $r, 0, 90); $gp.AddArc(0, $f.Height - $r, $r, $r, 90, 90); $gp.CloseFigure()
  $f.Region = New-Object System.Drawing.Region $gp

  $pic = New-Object System.Windows.Forms.PictureBox
  $pic.Image = $img; $pic.SizeMode = 'Zoom'; $pic.Size = New-Object System.Drawing.Size($size, $size); $pic.Location = New-Object System.Drawing.Point(30, 24)
  $pic.BackColor = $bg
  # Cut away the white corners: show only the circle (a hair inside its edge)
  $cp = New-Object System.Drawing.Drawing2D.GraphicsPath; $cp.AddEllipse(3, 3, $size - 6, $size - 6)
  $pic.Region = New-Object System.Drawing.Region $cp
  $f.Controls.Add($pic)

  $status = New-Object System.Windows.Forms.Label
  $status.Text = "Askar Studio  $dot  starting"; $status.ForeColor = $gold; $status.TextAlign = 'MiddleCenter'
  $status.Font = New-Object System.Drawing.Font('Georgia', 12); $status.Size = New-Object System.Drawing.Size(420, 34); $status.Location = New-Object System.Drawing.Point(0, 398)
  $f.Controls.Add($status)

  $script:ok = $false
  $script:opened = $null
  $script:dots = 0
  $started = Get-Date
  $deadline = $started.AddSeconds(45)
  $t = New-Object System.Windows.Forms.Timer
  $t.Interval = 300
  $t.Add_Tick({
    if (-not $script:opened -and (Test-Port)) {
      # Server answers: open the app windows, keep the logo up a moment longer so it doesn't just flash.
      $status.Text = "Askar Studio  $dot  opening"
      Open-Windows
      $script:opened = Get-Date
      $script:ok = $true
      return
    }
    if ($script:opened -and ((Get-Date) - $script:opened).TotalSeconds -ge 2.5) { $t.Stop(); $f.Close(); return }
    if (-not $script:opened -and (Get-Date) -gt $deadline) { $t.Stop(); $f.Close(); return }
    if (-not $script:opened) {
      $script:dots = ($script:dots + 1) % 4
      $status.Text = "Askar Studio  $dot  starting" + ('.' * $script:dots)
    }
  })
  # Start the server only after the logo is on screen, so the double-click gets instant feedback.
  $f.Add_Shown({ $f.Refresh(); if (-not (Test-Port)) { Start-Server }; $t.Start() })
  [System.Windows.Forms.Application]::Run($f)
  $img.Dispose()
  return $script:ok
}

function Start-Server {
  $node = (Get-Command node -ErrorAction SilentlyContinue).Source
  if (-not $node) { $node = Join-Path $env:ProgramFiles 'nodejs\node.exe' }
  if (-not (Test-Path $node)) { throw 'Askar needs Node.js. Install it from nodejs.org, then try again.' }
  $vite = Join-Path $repo 'node_modules\vite\bin\vite.js'
  Start-Process -FilePath $node -ArgumentList "`"$vite`"" -WorkingDirectory $repo -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir 'askar-server.log') -RedirectStandardError (Join-Path $logDir 'askar-server-errors.log')
}

function Open-Windows {
  $paths = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
  )
  $b = $paths | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
  $s = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
  $w = [int]($s.Width / 2)
  if ($b) {
    Start-Process $b -ArgumentList "--app=$askar", "--window-position=$($s.X),$($s.Y)", "--window-size=$w,$($s.Height)"
    Start-Process $b -ArgumentList "--app=$desk", "--window-position=$($s.X + $w),$($s.Y)", "--window-size=$w,$($s.Height)"
  } else {
    Start-Process $askar
    Start-Process $desk
  }
}

if (-not (Show-Splash)) { Show-Message "Askar did not start in time. Details are in:`n$logDir"; exit 1 }

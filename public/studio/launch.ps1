# Askar Studio: opens the Askar archive and the Land of Rebirth Desk side by side.
$askar = 'https://askar-archive.vercel.app/'
$desk  = 'https://claude.ai/artifact/Ae7qJiZFX6M5SD3ZNQf33S'
$paths = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
)
$b = $paths | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
Add-Type -AssemblyName System.Windows.Forms
$s = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$w = [int]($s.Width / 2)
if ($b) {
  Start-Process $b -ArgumentList "--app=$askar", "--window-position=$($s.X),$($s.Y)", "--window-size=$w,$($s.Height)"
  Start-Sleep -Milliseconds 800
  Start-Process $b -ArgumentList "--app=$desk", "--window-position=$($s.X + $w),$($s.Y)", "--window-size=$w,$($s.Height)"
} else {
  Start-Process $askar
  Start-Process $desk
}

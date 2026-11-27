# Signs Claude Code on this PC in to your Claude account, once, so the local Production Desk can use Claude
# (Break into frames, Fill fields, research briefs, notes from YouTube transcripts).
# It finds the same Claude Code the Desk uses: LOR_CLAUDE, else `claude` on PATH, else the copy inside the Claude desktop app.

$ErrorActionPreference = 'Stop'
$exe = $env:LOR_CLAUDE
if (-not $exe -or -not (Test-Path $exe)) { $exe = (Get-Command claude -ErrorAction SilentlyContinue).Source }
if (-not $exe) {
  $base = Join-Path $env:LOCALAPPDATA 'Claude-Data'
  $exe = Get-ChildItem -Path $base -Recurse -Depth 5 -Filter 'claude.exe' -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match '\\claude-code\\' } |
    Sort-Object { [version](($_.FullName -split '\\claude-code\\')[1].Split('\')[0] -replace '[^\d.]', '') } -Descending |
    Select-Object -First 1 -ExpandProperty FullName
}
if (-not $exe) { Write-Host 'Claude Code was not found on this PC. Install the Claude desktop app first.'; Read-Host 'Press Enter to close'; exit 1 }

Write-Host "Using Claude Code at:`n  $exe`n"
& $exe auth login
Write-Host ''
& $exe auth status --text
Write-Host "`nDone. Go back to the Desk and try again."
Read-Host 'Press Enter to close'

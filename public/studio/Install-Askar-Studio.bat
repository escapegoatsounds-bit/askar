@echo off
setlocal
title Askar Studio installer
rem Puts an "Askar Studio" icon on your desktop. Double-clicking it opens
rem the Askar archive and the Land of Rebirth Desk side by side.
rem Everything lives in %LOCALAPPDATA%\AskarStudio. To remove: delete that folder and the icon.

set "DIR=%LOCALAPPDATA%\AskarStudio"
if not exist "%DIR%" mkdir "%DIR%"

echo Downloading the launcher and icon...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -UseBasicParsing 'https://askar-archive.vercel.app/studio/launch.ps1' -OutFile '%DIR%\launch.ps1'; Invoke-WebRequest -UseBasicParsing 'https://askar-archive.vercel.app/askar-studio.ico' -OutFile '%DIR%\askar-studio.ico'"
if not exist "%DIR%\launch.ps1" (
  echo Could not download the launcher. Check your internet connection and run this again.
  pause
  exit /b 1
)

echo Creating the desktop shortcut...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=[Environment]::GetFolderPath('Desktop'); $ws=New-Object -ComObject WScript.Shell; $l=$ws.CreateShortcut((Join-Path $d 'Askar Studio.lnk')); $l.TargetPath='powershell.exe'; $l.Arguments='-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"%DIR%\launch.ps1\"'; $l.WorkingDirectory='%DIR%'; $l.IconLocation='%DIR%\askar-studio.ico'; $l.Description='Askar + Land of Rebirth Desk'; $l.Save()"

echo.
echo Done. Double-click "Askar Studio" on your desktop.
pause

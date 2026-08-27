@echo off
setlocal
cd /d "%~dp0"

echo ==================================
echo   NMDR RHYTHM - AUTO SONG SCAN
echo ==================================
echo.

if not exist "%CD%\tools\build_songs.ps1" (
    echo ERROR: tools\build_songs.ps1 not found.
    echo Please use the complete AUTOSCAN package.
    echo.
    pause
    exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%CD%\tools\build_songs.ps1"

if errorlevel 1 (
    echo.
    echo ERROR: Song scan failed.
    pause
    exit /b 1
)

echo.
echo Opening NMDR RHYTHM...
start "" "%CD%\index.html"
endlocal
exit /b 0

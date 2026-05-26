@echo off
REM Delega en scripts/deploy-functions.js (arregla PATH de Git + `sh` en Windows).
cd /d "%~dp0.."
node scripts/deploy-functions.js %*
exit /b %ERRORLEVEL%

@echo off
title API Server

REM Go to project directory
cd /d %~dp0

echo Starting ngrok...
start "ngrok tunnel" cmd /k "cd /d C:\Users\Admin\Downloads && ngrok http 5001"

echo Activating virtual environment...
call venv\Scripts\activate

echo Starting API...
python main.py

echo.
echo API stopped.
pause

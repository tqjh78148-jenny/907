@echo off
chcp 65001 >nul
title 頭前國中段考成績查詢與管理系統
echo ========================================================
echo   新北市立頭前國民中學 - 定期評量成績查詢與管理系統
echo   正在為您啟動系統與開啟瀏覽器...
echo ========================================================

REM 優先啟動 Python 本地伺服器
python run_server.py

REM 若無 Python 則直接以預設瀏覽器開啟 index.html
if %ERRORLEVEL% NEQ 0 (
    echo 正在以瀏覽器直接開啟 index.html ...
    start "" "%~dp0index.html"
)
pause

@echo off
chcp 65001 >nul
start "" msedge --start-fullscreen "%~dp0index.html"

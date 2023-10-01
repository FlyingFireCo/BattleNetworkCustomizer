@echo off
cd /d "%~dp0"
echo Building the project...
dotnet build -c Release
echo Publishing the project for win10-x64...
dotnet publish -c Release -r win10-x64 --self-contained true
echo Finished.

@echo off
cd /d "%~dp0"
echo Building the project...
dotnet build
echo Running the project...
dotnet run
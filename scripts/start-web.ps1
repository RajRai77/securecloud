<#
.SYNOPSIS
Starts the SecureCloud Web Frontend Development Server

.DESCRIPTION
This script is intended to be run on the Windows development machine to launch the React/Vite development server.
It will install dependencies if they are missing, and start the Vite dev server.

.EXAMPLE
.\scripts\start-web.ps1
#>

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
$WebDir = Join-Path $RootDir "web"

Set-Location $WebDir

Write-Host "Checking frontend dependencies..." -ForegroundColor Cyan
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies with npm install..." -ForegroundColor Yellow
    npm install
}

Write-Host "Starting SecureCloud Web Server..." -ForegroundColor Green
npm run dev

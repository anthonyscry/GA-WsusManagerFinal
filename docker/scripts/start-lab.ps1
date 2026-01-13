# Quick start script for WSUS Lab Environment
# This script starts the Docker containers and verifies the setup

param(
    [Parameter(Mandatory=$false)]
    [switch]$Stop,
    
    [Parameter(Mandatory=$false)]
    [switch]$Restart,
    
    [Parameter(Mandatory=$false)]
    [switch]$Logs,
    
    [Parameter(Mandatory=$false)]
    [switch]$Clean
)

$ErrorActionPreference = "Stop"

function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Cyan
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Test-DockerCompose {
    if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue) -and 
        -not (Get-Command docker -ErrorAction SilentlyContinue).Source) {
        Write-Host "ERROR: Docker Compose not found. Please install Docker Desktop." -ForegroundColor Red
        exit 1
    }
    
    # Check if docker is running
    try {
        docker ps | Out-Null
    }
    catch {
        Write-Host "ERROR: Docker is not running. Please start Docker Desktop." -ForegroundColor Red
        exit 1
    }
}

function Start-Lab {
    Write-Header "Starting WSUS Lab Environment"
    
    Test-DockerCompose
    
    # Navigate to project root (assumes script is in docker/scripts/)
    $projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    Set-Location $projectRoot
    
    Write-Host "Starting SQL Server container..." -ForegroundColor Yellow
    docker-compose up -d sqlserver
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "SQL Server container started successfully!" -ForegroundColor Green
        Write-Host ""
        
        # Run initialization script
        $initScript = Join-Path $PSScriptRoot "init-sqlserver.ps1"
        if (Test-Path $initScript) {
            Write-Host "Initializing SUSDB database..." -ForegroundColor Yellow
            & $initScript -ServerInstance "localhost,1433" -Username "SA" -Password "WSUS_Admin123!"
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host ""
                Write-Host "✅ Database initialization completed!" -ForegroundColor Green
            }
            else {
                Write-Host ""
                Write-Host "⚠️  Database initialization had issues, but container is running" -ForegroundColor Yellow
            }
        }
        else {
            Write-Host "Waiting for SQL Server to be ready (30 seconds)..." -ForegroundColor Yellow
            Start-Sleep -Seconds 30
        }
        
        # Check container health
        $health = docker-compose ps sqlserver
        Write-Host $health
        
        Write-Host ""
        Write-Host "SQL Server is available at:" -ForegroundColor Cyan
        Write-Host "  Server: localhost,1433" -ForegroundColor White
        Write-Host "  Username: SA" -ForegroundColor White
        Write-Host "  Password: WSUS_Admin123!" -ForegroundColor White
        Write-Host "  Database: SUSDB" -ForegroundColor White
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "1. Test connection: npm run test:docker" -ForegroundColor White
        Write-Host "2. Start your application: npm start" -ForegroundColor White
        Write-Host "3. Configure WSUS to connect to SQL Server (see docker/README.md)" -ForegroundColor White
    }
    else {
        Write-Host "ERROR: Failed to start SQL Server container" -ForegroundColor Red
        exit 1
    }
}

function Stop-Lab {
    Write-Header "Stopping WSUS Lab Environment"
    
    Test-DockerCompose
    
    $projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    Set-Location $projectRoot
    
    Write-Host "Stopping containers..." -ForegroundColor Yellow
    docker-compose stop
    
    Write-Host "Containers stopped." -ForegroundColor Green
}

function Restart-Lab {
    Write-Header "Restarting WSUS Lab Environment"
    Stop-Lab
    Start-Sleep -Seconds 2
    Start-Lab
}

function Show-Logs {
    Write-Header "WSUS Lab Environment Logs"
    
    Test-DockerCompose
    
    $projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    Set-Location $projectRoot
    
    docker-compose logs -f sqlserver
}

function Clean-Lab {
    Write-Header "Cleaning WSUS Lab Environment"
    
    $confirm = Read-Host "This will stop and remove all containers and volumes. Continue? (Y/N)"
    if ($confirm -ne "Y" -and $confirm -ne "y") {
        Write-Host "Clean cancelled" -ForegroundColor Yellow
        return
    }
    
    Test-DockerCompose
    
    $projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    Set-Location $projectRoot
    
    Write-Host "Stopping and removing containers and volumes..." -ForegroundColor Yellow
    docker-compose down -v
    
    Write-Host "Clean completed. All data has been removed." -ForegroundColor Green
}

# Main execution
if ($Stop) {
    Stop-Lab
}
elseif ($Restart) {
    Restart-Lab
}
elseif ($Logs) {
    Show-Logs
}
elseif ($Clean) {
    Clean-Lab
}
else {
    Start-Lab
}

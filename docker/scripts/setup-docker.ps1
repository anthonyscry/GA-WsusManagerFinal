# Comprehensive Docker Setup Script for WSUS Manager
# This script checks Docker installation, sets up the lab environment, and verifies everything is ready
# Run as Administrator for full functionality

param(
    [Parameter(Mandatory=$false)]
    [switch]$SkipDockerCheck,
    
    [Parameter(Mandatory=$false)]
    [switch]$InstallDocker,
    
    [Parameter(Mandatory=$false)]
    [switch]$FullSetup
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

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Test-DockerInstalled {
    Write-Header "Checking Docker Installation"
    
    $dockerInstalled = $false
    
    # Check Docker
    try {
        $dockerVersion = docker --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Docker is installed: $dockerVersion"
            $dockerInstalled = $true
        }
    }
    catch {
        Write-Warning "Docker is not installed or not in PATH"
    }
    
    # Check Docker Compose
    try {
        $composeVersion = docker-compose --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Docker Compose is installed: $composeVersion"
        }
        else {
            # Try docker compose (v2)
            $composeV2 = docker compose version 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Docker Compose (v2) is available: $composeV2"
            }
        }
    }
    catch {
        Write-Warning "Docker Compose is not installed or not in PATH"
    }
    
    # Check if Docker is running
    if ($dockerInstalled) {
        try {
            docker ps | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Docker daemon is running"
                return $true
            }
        }
        catch {
            Write-Warning "Docker daemon is not running. Please start Docker Desktop."
            return $false
        }
    }
    
    return $dockerInstalled
}

function Install-DockerDesktop {
    Write-Header "Docker Desktop Installation Guide"
    
    Write-Host "Docker Desktop installation requires manual steps:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Download Docker Desktop for Windows:" -ForegroundColor Cyan
    Write-Host "   https://www.docker.com/products/docker-desktop" -ForegroundColor White
    Write-Host ""
    Write-Host "2. Run the installer and follow the setup wizard" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "3. Restart your computer if prompted" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "4. Start Docker Desktop from the Start menu" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "5. Wait for Docker Desktop to fully start (whale icon in system tray)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "6. Run this script again: .\docker\scripts\setup-docker.ps1" -ForegroundColor Cyan
    Write-Host ""
    
    # Try to open download page
    try {
        Start-Process "https://www.docker.com/products/docker-desktop"
    }
    catch {
        Write-Warning "Could not open browser. Please visit the URL manually."
    }
}

function Start-LabEnvironment {
    Write-Header "Setting Up Lab Environment"
    
    $projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    Set-Location $projectRoot
    
    # Check if docker-compose.yml exists
    if (-not (Test-Path "docker-compose.yml")) {
        Write-Error "docker-compose.yml not found in project root"
        return $false
    }
    
    Write-Success "Found docker-compose.yml"
    
    # Start SQL Server container
    Write-Host "Starting SQL Server container..." -ForegroundColor Yellow
    try {
        docker-compose up -d sqlserver
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "SQL Server container started"
            
            Write-Host "Waiting for SQL Server to be ready..." -ForegroundColor Yellow
            
            # Run initialization script
            $initScript = Join-Path $PSScriptRoot "init-sqlserver.ps1"
            if (Test-Path $initScript) {
                Write-Host "Initializing SUSDB database..." -ForegroundColor Yellow
                & $initScript -ServerInstance "localhost,1433" -Username "SA" -Password "WSUS_Admin123!"
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Success "Database initialization completed"
                }
                else {
                    Write-Warning "Database initialization had issues, but container is running"
                }
            }
            else {
                Write-Warning "Initialization script not found, skipping database setup"
                Write-Host "Waiting for SQL Server to be ready (30 seconds)..." -ForegroundColor Yellow
                Start-Sleep -Seconds 30
            }
            
            # Check container health
            $health = docker-compose ps sqlserver
            Write-Host $health
            
            return $true
        }
        else {
            Write-Error "Failed to start SQL Server container"
            return $false
        }
    }
    catch {
        Write-Error "Error starting container: $_"
        return $false
    }
}

function Test-SqlConnection {
    Write-Header "Testing SQL Server Connection"
    
    try {
        # Check if SqlServer module is available
        if (-not (Get-Module -ListAvailable -Name SqlServer)) {
            Write-Warning "SqlServer PowerShell module not found. Installing..."
            Install-Module -Name SqlServer -Force -Scope CurrentUser -AllowClobber -ErrorAction SilentlyContinue
        }
        
        Import-Module SqlServer -ErrorAction Stop
        
        $connectionString = "Server=localhost,1433;Database=SUSDB;User Id=SA;Password=WSUS_Admin123!;TrustServerCertificate=True;"
        
        $query = "SELECT @@VERSION AS Version, DB_NAME() AS CurrentDatabase"
        $result = Invoke-Sqlcmd -ConnectionString $connectionString -Query $query -ErrorAction Stop
        
        Write-Success "SQL Server connection successful!"
        Write-Host "  Version: $($result.Version)" -ForegroundColor White
        Write-Host "  Database: $($result.CurrentDatabase)" -ForegroundColor White
        
        return $true
    }
    catch {
        Write-Warning "SQL Server connection test failed: $_"
        Write-Host "This is normal if SQL Server is still starting up. Wait a few minutes and try again." -ForegroundColor Yellow
        return $false
    }
}

function Install-WsusModule {
    Write-Header "Checking WSUS PowerShell Module"
    
    $module = Get-Module -ListAvailable -Name UpdateServices
    if ($module) {
        Write-Success "WSUS PowerShell module is installed"
        return $true
    }
    else {
        Write-Warning "WSUS PowerShell module not found"
        
        $install = Read-Host "Would you like to install it now? (Y/N)"
        if ($install -eq "Y" -or $install -eq "y") {
            try {
                Install-Module -Name UpdateServices -Force -Scope CurrentUser -AllowClobber -ErrorAction Stop
                Write-Success "WSUS PowerShell module installed"
                return $true
            }
            catch {
                Write-Error "Failed to install WSUS PowerShell module: $_"
                return $false
            }
        }
        else {
            Write-Warning "Skipping WSUS module installation"
            return $false
        }
    }
}

function Show-Summary {
    Write-Header "Setup Summary"
    
    Write-Host "Lab Environment Status:" -ForegroundColor Cyan
    Write-Host ""
    
    # Check Docker
    $dockerOk = Test-DockerInstalled
    if ($dockerOk) {
        Write-Success "Docker: Ready"
    }
    else {
        Write-Error "Docker: Not ready"
    }
    
    # Check containers
    try {
        $containers = docker-compose ps
        if ($containers -match "wsus-sqlserver") {
            Write-Success "SQL Server Container: Running"
        }
        else {
            Write-Warning "SQL Server Container: Not running"
        }
    }
    catch {
        Write-Warning "SQL Server Container: Status unknown"
    }
    
    # Check WSUS module
    $wsusModule = Get-Module -ListAvailable -Name UpdateServices
    if ($wsusModule) {
        Write-Success "WSUS PowerShell Module: Installed"
    }
    else {
        Write-Warning "WSUS PowerShell Module: Not installed"
    }
    
    Write-Host ""
    Write-Host "Connection Information:" -ForegroundColor Cyan
    Write-Host "  Server: localhost,1433" -ForegroundColor White
    Write-Host "  Username: SA" -ForegroundColor White
    Write-Host "  Password: WSUS_Admin123!" -ForegroundColor White
    Write-Host "  Database: SUSDB" -ForegroundColor White
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "1. Test connection: npm run test:docker" -ForegroundColor White
    Write-Host "2. View logs: npm run docker:logs" -ForegroundColor White
    Write-Host "3. Start application: npm start" -ForegroundColor White
    Write-Host ""
}

# Main execution
Write-Header "WSUS Manager - Docker Setup Script"

# Check Docker installation
if (-not $SkipDockerCheck) {
    $dockerReady = Test-DockerInstalled
    
    if (-not $dockerReady) {
        if ($InstallDocker) {
            Install-DockerDesktop
            exit 0
        }
        else {
            Write-Warning "Docker is not installed or not running"
            Write-Host ""
            $install = Read-Host "Would you like to see Docker installation instructions? (Y/N)"
            if ($install -eq "Y" -or $install -eq "y") {
                Install-DockerDesktop
                exit 0
            }
            else {
                Write-Warning "Cannot proceed without Docker. Exiting."
                exit 1
            }
        }
    }
}

# Setup lab environment
if ($FullSetup -or $dockerReady) {
    $setupSuccess = Start-LabEnvironment
    
    if ($setupSuccess) {
        # Test connection (with delay for SQL Server startup)
        Start-Sleep -Seconds 10
        Test-SqlConnection
        
        # Check WSUS module
        Install-WsusModule
    }
}

# Show summary
Show-Summary

Write-Host ""
Write-Success "Setup script completed!"
Write-Host ""

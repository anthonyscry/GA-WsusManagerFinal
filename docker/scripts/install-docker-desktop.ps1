# Docker Desktop Installation Helper Script
# This script helps guide you through Docker Desktop installation

param(
    [Parameter(Mandatory=$false)]
    [switch]$CheckOnly
)

$ErrorActionPreference = "Continue"

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

function Write-InfoMsg {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Cyan
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

Write-Header "Docker Desktop Installation Helper"

# Check if Docker is already installed
Write-InfoMsg "Checking for existing Docker installation..."

$dockerInstalled = $false
$dockerRunning = $false

# Check if docker command is available
try {
    $dockerVersion = docker --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Docker is installed: $dockerVersion"
        $dockerInstalled = $true
        
        # Check if Docker daemon is running
        try {
            docker ps | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Docker daemon is running"
                $dockerRunning = $true
            }
        }
        catch {
            Write-Warning "Docker daemon is not running"
        }
    }
}
catch {
    Write-Warning "Docker command not found in PATH"
}

# Check common installation locations
if (-not $dockerInstalled) {
    $dockerPaths = @(
        "C:\Program Files\Docker\Docker\Docker Desktop.exe",
        "C:\Program Files (x86)\Docker\Docker\Docker Desktop.exe",
        "$env:LOCALAPPDATA\Docker\Docker Desktop.exe"
    )
    
    foreach ($path in $dockerPaths) {
        if (Test-Path $path) {
            Write-Success "Found Docker Desktop at: $path"
            $dockerInstalled = $true
            Write-InfoMsg "Docker Desktop is installed but may not be in PATH"
            Write-InfoMsg "Try starting Docker Desktop manually, then run this script again"
            break
        }
    }
}

# Check registry for Docker installation
if (-not $dockerInstalled) {
    try {
        $dockerReg = Get-ItemProperty "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" -ErrorAction SilentlyContinue | 
            Where-Object { $_.DisplayName -like "*Docker Desktop*" }
        
        if ($dockerReg) {
            Write-Success "Found Docker Desktop in registry: $($dockerReg.DisplayName)"
            Write-InfoMsg "Installation location: $($dockerReg.InstallLocation)"
            $dockerInstalled = $true
        }
    }
    catch {
        # Registry check failed, continue
    }
}

if ($dockerInstalled -and $dockerRunning) {
    Write-Success "Docker Desktop is installed and running!"
    Write-InfoMsg "You can now use: npm run docker:setup"
    exit 0
}

if ($dockerInstalled -and -not $dockerRunning) {
    Write-Warning "Docker Desktop is installed but not running"
    Write-InfoMsg "Please start Docker Desktop from the Start menu, then run this script again"
    exit 0
}

if ($CheckOnly) {
    Write-InfoMsg "Docker Desktop is not installed"
    exit 1
}

# Installation instructions
Write-Header "Docker Desktop Installation Instructions"

Write-InfoMsg "Docker Desktop is not installed. Here is how to install it:"
Write-Host ""

Write-Host "Option 1: Download and Install Manually" -ForegroundColor Yellow
Write-Host "1. Visit: https://www.docker.com/products/docker-desktop" -ForegroundColor White
Write-Host "2. Click Download for Windows" -ForegroundColor White
Write-Host "3. Run the installer (Docker Desktop Installer.exe)" -ForegroundColor White
Write-Host "4. Follow the installation wizard" -ForegroundColor White
Write-Host "5. Restart your computer if prompted" -ForegroundColor White
Write-Host "6. Start Docker Desktop from the Start menu" -ForegroundColor White
Write-Host "7. Wait for Docker Desktop to fully start (system tray icon)" -ForegroundColor White
Write-Host "8. Run this script again to verify: .\docker\scripts\install-docker-desktop.ps1" -ForegroundColor White
Write-Host ""

Write-Host "Option 2: Use Winget (Windows Package Manager)" -ForegroundColor Yellow
Write-Host "If you have winget installed, you can run:" -ForegroundColor White
Write-Host "  winget install Docker.DockerDesktop" -ForegroundColor Cyan
Write-Host ""

Write-Host "Option 3: Use Chocolatey" -ForegroundColor Yellow
Write-Host "If you have Chocolatey installed, you can run:" -ForegroundColor White
Write-Host "  choco install docker-desktop" -ForegroundColor Cyan
Write-Host ""

# Check if winget is available
Write-InfoMsg "Checking for package managers..."
$wingetAvailable = $false
$chocoAvailable = $false

try {
    $wingetVersion = winget --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Winget is available: $wingetVersion"
        $wingetAvailable = $true
        Write-Host ""
        Write-Host "Would you like to install Docker Desktop using Winget?" -ForegroundColor Yellow
        Write-Host "Run this command:" -ForegroundColor Cyan
        Write-Host "  winget install Docker.DockerDesktop" -ForegroundColor White
        Write-Host ""
    }
}
catch {
    Write-Warning "Winget is not available"
}

try {
    $chocoVersion = choco --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Chocolatey is available: $chocoVersion"
        $chocoAvailable = $true
        Write-Host ""
        Write-Host "Would you like to install Docker Desktop using Chocolatey?" -ForegroundColor Yellow
        Write-Host "Run this command (as Administrator):" -ForegroundColor Cyan
        Write-Host "  choco install docker-desktop -y" -ForegroundColor White
        Write-Host ""
    }
}
catch {
    Write-Warning "Chocolatey is not available"
}

if (-not $wingetAvailable -and -not $chocoAvailable) {
    Write-InfoMsg "No package managers found. Please use Option 1 (manual download)"
}

Write-Header "After Installation"

Write-Host "Once Docker Desktop is installed and running:" -ForegroundColor Yellow
Write-Host "1. Verify installation: .\docker\scripts\install-docker-desktop.ps1" -ForegroundColor White
Write-Host "2. Run setup: npm run docker:setup" -ForegroundColor White
Write-Host "3. Test connection: npm run docker:test:app" -ForegroundColor White
Write-Host ""

Write-InfoMsg "Installation requires administrator privileges"
Write-InfoMsg "The installer will guide you through the process"

# PowerShell script to set up WSUS on local Windows machine
# This script helps configure WSUS to connect to the Docker SQL Server container
# Run as Administrator

param(
    [Parameter(Mandatory=$false)]
    [string]$SqlServerInstance = "localhost,1433",
    
    [Parameter(Mandatory=$false)]
    [string]$SqlServerUser = "SA",
    
    [Parameter(Mandatory=$false)]
    [string]$SqlServerPassword = "WSUS_Admin123!",
    
    [Parameter(Mandatory=$false)]
    [string]$DatabaseName = "SUSDB",
    
    [Parameter(Mandatory=$false)]
    [string]$WsusContentPath = "C:\WSUS\Content",
    
    [Parameter(Mandatory=$false)]
    [int]$WsusPort = 8530
)

Write-Host "WSUS Lab Environment Setup Script" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator" -ForegroundColor Red
    exit 1
}

# Check if WSUS feature is installed
$wsusInstalled = Get-WindowsFeature -Name UpdateServices
if ($wsusInstalled.InstallState -ne "Installed") {
    Write-Host "WSUS feature not found. Installing..." -ForegroundColor Yellow
    try {
        Install-WindowsFeature -Name UpdateServices -IncludeManagementTools -ErrorAction Stop
        Write-Host "WSUS feature installed successfully" -ForegroundColor Green
    }
    catch {
        Write-Host "ERROR: Failed to install WSUS feature: $_" -ForegroundColor Red
        exit 1
    }
}
else {
    Write-Host "WSUS feature is already installed" -ForegroundColor Green
}

# Check if WSUS PowerShell module is installed
$module = Get-Module -ListAvailable -Name UpdateServices
if (-not $module) {
    Write-Host "WSUS PowerShell module not found. Installing..." -ForegroundColor Yellow
    try {
        Install-Module -Name UpdateServices -Force -Scope AllUsers -AllowClobber -ErrorAction Stop
        Write-Host "WSUS PowerShell module installed successfully" -ForegroundColor Green
    }
    catch {
        Write-Host "ERROR: Failed to install WSUS PowerShell module: $_" -ForegroundColor Red
        Write-Host "You may need to run: Set-PSRepository -Name PSGallery -InstallationPolicy Trusted" -ForegroundColor Yellow
        exit 1
    }
}
else {
    Write-Host "WSUS PowerShell module is already installed" -ForegroundColor Green
}

# Import WSUS module
Import-Module UpdateServices -ErrorAction Stop

# Create content directory if it doesn't exist
if (-not (Test-Path $WsusContentPath)) {
    Write-Host "Creating WSUS content directory: $WsusContentPath" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $WsusContentPath -Force | Out-Null
}

Write-Host ""
Write-Host "Configuration Summary:" -ForegroundColor Cyan
Write-Host "  SQL Server Instance: $SqlServerInstance"
Write-Host "  SQL Server User: $SqlServerUser"
Write-Host "  Database Name: $DatabaseName"
Write-Host "  WSUS Content Path: $WsusContentPath"
Write-Host "  WSUS Port: $WsusPort"
Write-Host ""

$confirm = Read-Host "Continue with WSUS configuration? (Y/N)"
if ($confirm -ne "Y" -and $confirm -ne "y") {
    Write-Host "Setup cancelled" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "IMPORTANT: WSUS configuration requires manual steps:" -ForegroundColor Yellow
Write-Host "1. Open WSUS Configuration Wizard (wsus.msc)" -ForegroundColor White
Write-Host "2. Specify SQL Server connection:" -ForegroundColor White
Write-Host "   - Server: $SqlServerInstance" -ForegroundColor White
Write-Host "   - Authentication: SQL Server Authentication" -ForegroundColor White
Write-Host "   - User: $SqlServerUser" -ForegroundColor White
Write-Host "   - Password: $SqlServerPassword" -ForegroundColor White
Write-Host "   - Database: $DatabaseName" -ForegroundColor White
Write-Host "3. Complete the WSUS configuration wizard" -ForegroundColor White
Write-Host ""
Write-Host "Alternatively, use wsusutil.exe postinstall command:" -ForegroundColor Cyan
Write-Host "wsusutil.exe postinstall SQL_INSTANCE_NAME=`"$SqlServerInstance`" CONTENT_PATH=$WsusContentPath" -ForegroundColor White
Write-Host ""

# Test SQL Server connection
Write-Host "Testing SQL Server connection..." -ForegroundColor Yellow
try {
    $sqlModule = Get-Module -ListAvailable -Name SqlServer
    if (-not $sqlModule) {
        Write-Host "SQL Server PowerShell module not found. Installing..." -ForegroundColor Yellow
        Install-Module -Name SqlServer -Force -Scope AllUsers -AllowClobber -ErrorAction Stop
    }
    Import-Module SqlServer -ErrorAction Stop
    
    $securePassword = ConvertTo-SecureString $SqlServerPassword -AsPlainText -Force
    $credential = New-Object System.Management.Automation.PSCredential($SqlServerUser, $securePassword)
    
    $testQuery = "SELECT @@VERSION"
    $result = Invoke-Sqlcmd -ServerInstance $SqlServerInstance -Database "master" -Credential $credential -Query $testQuery -ErrorAction Stop
    
    Write-Host "SQL Server connection successful!" -ForegroundColor Green
    Write-Host "SQL Server Version: $($result.Column1)" -ForegroundColor Green
}
catch {
    Write-Host "WARNING: Could not connect to SQL Server: $_" -ForegroundColor Yellow
    Write-Host "Make sure the SQL Server container is running and accessible" -ForegroundColor Yellow
    Write-Host "Run: docker-compose up -d sqlserver" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Setup script completed!" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Ensure SQL Server container is running: docker-compose up -d sqlserver" -ForegroundColor White
Write-Host "2. Configure WSUS using the WSUS Configuration Wizard" -ForegroundColor White
Write-Host "3. Start WSUS service: Start-Service WsusService" -ForegroundColor White
Write-Host "4. Test connection: Get-WsusServer -Name localhost -PortNumber $WsusPort" -ForegroundColor White

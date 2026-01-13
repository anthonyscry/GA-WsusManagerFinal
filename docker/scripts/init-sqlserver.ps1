# SQL Server Initialization Script
# This script initializes the SUSDB database after SQL Server container is ready
# Run this script after the container has started and SQL Server is ready

param(
    [Parameter(Mandatory=$false)]
    [string]$ServerInstance = "localhost,1433",
    
    [Parameter(Mandatory=$false)]
    [string]$Username = "SA",
    
    [Parameter(Mandatory=$false)]
    [string]$Password = "WSUS_Admin123!",
    
    [Parameter(Mandatory=$false)]
    [int]$MaxRetries = 30,
    
    [Parameter(Mandatory=$false)]
    [int]$RetryDelaySeconds = 5
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

function Wait-ForSqlServer {
    param(
        [string]$ServerInstance,
        [string]$Username,
        [string]$Password,
        [int]$MaxRetries,
        [int]$RetryDelaySeconds
    )
    
    Write-Host "Waiting for SQL Server to be ready..." -ForegroundColor Yellow
    
    # Check if SqlServer module is available
    if (-not (Get-Module -ListAvailable -Name SqlServer)) {
        Write-Host "Installing SqlServer PowerShell module..." -ForegroundColor Yellow
        Install-Module -Name SqlServer -Force -Scope CurrentUser -AllowClobber -ErrorAction SilentlyContinue | Out-Null
    }
    
    Import-Module SqlServer -ErrorAction SilentlyContinue
    
    $connectionString = "Server=$ServerInstance;Database=master;User Id=$Username;Password=$Password;TrustServerCertificate=True;"
    
    for ($i = 1; $i -le $MaxRetries; $i++) {
        try {
            $result = Invoke-Sqlcmd -ConnectionString $connectionString -Query "SELECT @@VERSION" -ErrorAction Stop -ConnectionTimeout 5
            Write-Success "SQL Server is ready!"
            return $true
        }
        catch {
            Write-Host "Attempt $i/$MaxRetries - SQL Server not ready yet, waiting ${RetryDelaySeconds}s..." -ForegroundColor Yellow
            Start-Sleep -Seconds $RetryDelaySeconds
        }
    }
    
    Write-Error "SQL Server did not become ready after $($MaxRetries * $RetryDelaySeconds) seconds"
    return $false
}

function Initialize-Susdb {
    param(
        [string]$ServerInstance,
        [string]$Username,
        [string]$Password
    )
    
    Write-Header "Initializing SUSDB Database"
    
    $scriptDir = Split-Path -Parent $PSScriptRoot
    $projectRoot = Split-Path -Parent (Split-Path -Parent $scriptDir)
    $initScript1 = Join-Path $projectRoot "docker\sql\init\01-init-susdb.sql"
    $initScript2 = Join-Path $projectRoot "docker\sql\init\02-setup-permissions.sql"
    
    if (-not (Test-Path $initScript1)) {
        Write-Error "Initialization script not found: $initScript1"
        return $false
    }
    
    if (-not (Test-Path $initScript2)) {
        Write-Error "Permissions script not found: $initScript2"
        return $false
    }
    
    Import-Module SqlServer -ErrorAction Stop
    
    $connectionString = "Server=$ServerInstance;Database=master;User Id=$Username;Password=$Password;TrustServerCertificate=True;"
    
    try {
        # Check if SUSDB already exists
        $dbCheck = Invoke-Sqlcmd -ConnectionString $connectionString -Query "SELECT name FROM sys.databases WHERE name = 'SUSDB'" -ErrorAction SilentlyContinue
        
        if ($dbCheck) {
            Write-Warning "SUSDB database already exists. Skipping initialization."
            return $true
        }
        
        Write-Host "Running initialization script 1: 01-init-susdb.sql" -ForegroundColor Yellow
        $script1Content = Get-Content $initScript1 -Raw
        Invoke-Sqlcmd -ConnectionString $connectionString -Query $script1Content -ErrorAction Stop
        
        Write-Success "Database initialization completed"
        
        Write-Host "Running initialization script 2: 02-setup-permissions.sql" -ForegroundColor Yellow
        $script2Content = Get-Content $initScript2 -Raw
        Invoke-Sqlcmd -ConnectionString $connectionString -Query $script2Content -ErrorAction Stop
        
        Write-Success "Permissions setup completed"
        
        return $true
    }
    catch {
        Write-Error "Failed to initialize SUSDB: $_"
        return $false
    }
}

# Main execution
Write-Header "SQL Server Initialization"

# Wait for SQL Server to be ready
$serverReady = Wait-ForSqlServer -ServerInstance $ServerInstance -Username $Username -Password $Password -MaxRetries $MaxRetries -RetryDelaySeconds $RetryDelaySeconds

if (-not $serverReady) {
    Write-Error "Cannot proceed - SQL Server is not ready"
    exit 1
}

# Initialize SUSDB
$initSuccess = Initialize-Susdb -ServerInstance $ServerInstance -Username $Username -Password $Password

if ($initSuccess) {
    Write-Header "Initialization Complete"
    Write-Success "SUSDB database is ready for use"
    Write-Host ""
    Write-Host "Connection Information:" -ForegroundColor Cyan
    Write-Host "  Server: $ServerInstance" -ForegroundColor White
    Write-Host "  Username: $Username" -ForegroundColor White
    Write-Host "  Password: $Password" -ForegroundColor White
    Write-Host "  Database: SUSDB" -ForegroundColor White
    Write-Host ""
    exit 0
}
else {
    Write-Error "Initialization failed"
    exit 1
}

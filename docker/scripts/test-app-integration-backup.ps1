# Test script to verify Docker container connectivity
# Tests SQL Server connection from the application's perspective

param(
    [Parameter(Mandatory=$false)]
    [string]$ServerInstance = "localhost,1433",
    
    [Parameter(Mandatory=$false)]
    [string]$Username = "SA",
    
    [Parameter(Mandatory=$false)]
    [string]$Password = "WSUS_Admin123!",
    
    [Parameter(Mandatory=$false)]
    [string]$Database = "SUSDB"
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

function Test-SqlConnection {
    param(
        [string]$ServerInstance,
        [string]$Username,
        [string]$Password,
        [string]$Database
    )
    
    Write-Header "Testing SQL Server Connection"
    
    Write-Host "Connection Details:" -ForegroundColor Yellow
    Write-Host "  Server: $ServerInstance" -ForegroundColor White
    Write-Host "  Username: $Username" -ForegroundColor White
    Write-Host "  Database: $Database" -ForegroundColor White
    Write-Host ""
    
    try {
        # Test connection using PowerShell SQL cmdlets
        Write-Host "Testing connection..." -ForegroundColor Yellow
        
        $securePassword = ConvertTo-SecureString $Password -AsPlainText -Force
        $credential = New-Object System.Management.Automation.PSCredential($Username, $securePassword)
        
        # Check if SQL Server module is available
        if (-not (Get-Module -ListAvailable -Name SqlServer)) {
            Write-Host "Installing SqlServer PowerShell module..." -ForegroundColor Yellow
            Install-Module -Name SqlServer -Force -Scope CurrentUser -AllowClobber -ErrorAction SilentlyContinue
        }
        
        Import-Module SqlServer -ErrorAction Stop
        
        # Test basic connection
        $query = "SELECT @@VERSION AS Version, DB_NAME() AS CurrentDatabase, SYSTEM_USER AS CurrentUser"
        $result = Invoke-Sqlcmd -ServerInstance $ServerInstance -Database $Database -Credential $credential -Query $query -ErrorAction Stop
        
        Write-Host "✅ Connection successful!" -ForegroundColor Green
        Write-Host ""
        Write-Host "SQL Server Information:" -ForegroundColor Cyan
        Write-Host "  Version: $($result.Version)" -ForegroundColor White
        Write-Host "  Current Database: $($result.CurrentDatabase)" -ForegroundColor White
        Write-Host "  Current User: $($result.CurrentUser)" -ForegroundColor White
        Write-Host ""
        
        # Test SUSDB-specific queries (if database exists)
        Write-Host "Testing SUSDB-specific queries..." -ForegroundColor Yellow
        $susdbQuery = @"
            IF DB_ID('SUSDB') IS NOT NULL
            BEGIN
                SELECT 'SUSDB database exists' AS Status
                SELECT COUNT(*) AS TableCount FROM SUSDB.INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'
            END
            ELSE
            BEGIN
                SELECT 'SUSDB database does not exist yet' AS Status
            END
"@
        
        $susdbResult = Invoke-Sqlcmd -ServerInstance $ServerInstance -Credential $credential -Query $susdbQuery -ErrorAction SilentlyContinue
        
        if ($susdbResult) {
            Write-Host "✅ SUSDB database check completed" -ForegroundColor Green
        }
        
        return $true
    }
    catch {
        Write-Host "❌ Connection failed!" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        Write-Host "Troubleshooting:" -ForegroundColor Yellow
        Write-Host "1. Ensure Docker container is running: docker-compose ps" -ForegroundColor White
        Write-Host "2. Check container logs: docker-compose logs sqlserver" -ForegroundColor White
        Write-Host "3. Verify SQL Server is ready: docker exec wsus-sqlserver /opt/mssql-tools/bin/sqlcmd -S localhost -U SA -P '$Password' -Q 'SELECT 1'" -ForegroundColor White
        return $false
    }
}

function Test-ApplicationServices {
    Write-Header "Testing Application Service Connections"
    
    Write-Host "This test verifies that the application can connect to:" -ForegroundColor Yellow
    Write-Host "  - SQL Server (via sqlService)" -ForegroundColor White
    Write-Host "  - WSUS Server (via wsusService)" -ForegroundColor White
    Write-Host ""
    Write-Host "Note: Full testing requires the application to be running." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To test the application:" -ForegroundColor Cyan
    Write-Host "1. Start the Docker SQL Server: docker-compose up -d sqlserver" -ForegroundColor White
    Write-Host "2. Start the application: npm start" -ForegroundColor White
    Write-Host "3. Navigate to Maintenance view" -ForegroundColor White
    Write-Host "4. Try database operations (reindex, cleanup)" -ForegroundColor White
    Write-Host ""
}

# Main execution
Write-Header "WSUS Manager - Docker Container Connection Test"

# Check if Docker is available
try {
    docker ps | Out-Null
    Write-Host "✅ Docker is available" -ForegroundColor Green
}
catch {
    Write-Host "⚠️  Docker is not available or not running" -ForegroundColor Yellow
    Write-Host "Please install Docker Desktop and ensure it's running." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# Check if container is running
$containerRunning = docker ps --filter "name=wsus-sqlserver" --format "{{.Names}}" | Select-String "wsus-sqlserver"

if (-not $containerRunning) {
    Write-Host "⚠️  SQL Server container is not running" -ForegroundColor Yellow
    Write-Host "Starting container..." -ForegroundColor Yellow
    
    $projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    Set-Location $projectRoot
    docker-compose up -d sqlserver
    
    Write-Host "Waiting for SQL Server to be ready (30 seconds)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
}

# Test SQL connection
$connectionSuccess = Test-SqlConnection -ServerInstance $ServerInstance -Username $Username -Password $Password -Database $Database

if ($connectionSuccess) {
    Test-ApplicationServices
    
    Write-Header "Test Summary"
    Write-Host "✅ SQL Server container is accessible" -ForegroundColor Green
    Write-Host "✅ Connection test passed" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Configure your application to use: localhost,1433" -ForegroundColor White
    Write-Host "2. Use credentials: SA / WSUS_Admin123!" -ForegroundColor White
    Write-Host "3. Start the application and test database operations" -ForegroundColor White
}
else {
    Write-Host ""
    Write-Host "❌ Connection test failed. Please check the troubleshooting steps above." -ForegroundColor Red
    exit 1
}

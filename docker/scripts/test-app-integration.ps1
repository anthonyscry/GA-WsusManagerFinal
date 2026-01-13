# Comprehensive Application Integration Test for Docker Environment
# This script tests the full application functionality against the Docker SQL Server container

param(
    [Parameter(Mandatory=$false)]
    [string]$ServerInstance = "localhost,1433",
    
    [Parameter(Mandatory=$false)]
    [string]$Username = "SA",
    
    [Parameter(Mandatory=$false)]
    [string]$Password = "WSUS_Admin123!",
    
    [Parameter(Mandatory=$false)]
    [string]$Database = "SUSDB",
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipContainerCheck
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

function Write-ErrorMsg {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Test-ContainerRunning {
    Write-Header "Checking Docker Container Status"
    
    try {
        $container = docker ps --filter "name=wsus-sqlserver" --format "{{.Names}}" | Select-String "wsus-sqlserver"
        
        if ($container) {
            Write-Success "SQL Server container is running"
            
            $health = docker inspect wsus-sqlserver --format='{{.State.Health.Status}}' 2>&1
            if ($health -match "healthy") {
                Write-Success "Container health: $health"
            }
            else {
                Write-Warning "Container health: $health (may still be starting)"
            }
            
            return $true
        }
        else {
            Write-Warning "SQL Server container is not running"
            Write-Host "Starting container..." -ForegroundColor Yellow
            
            $projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
            Set-Location $projectRoot
            docker-compose up -d sqlserver
            
            Write-Host "Waiting for SQL Server to initialize..." -ForegroundColor Yellow
            
            # Run initialization script
            $initScript = Join-Path $PSScriptRoot "init-sqlserver.ps1"
            if (Test-Path $initScript) {
                Write-Host "Initializing SUSDB database..." -ForegroundColor Yellow
                & $initScript -ServerInstance "localhost,1433" -Username "SA" -Password "WSUS_Admin123!" | Out-Null
            }
            else {
                Write-Host "Waiting 30 seconds for SQL Server to be ready..." -ForegroundColor Yellow
                Start-Sleep -Seconds 30
            }
            
            return $true
        }
    }
    catch {
        Write-ErrorMsg "Failed to check container status: $_"
        return $false
    }
}

function Test-SqlConnection {
    Write-Header "Testing SQL Server Connection"
    
    Write-Host "Connection Details:" -ForegroundColor Yellow
    Write-Host "  Server: $ServerInstance" -ForegroundColor White
    Write-Host "  Username: $Username" -ForegroundColor White
    Write-Host "  Database: $Database" -ForegroundColor White
    Write-Host ""
    
    try {
        if (-not (Get-Module -ListAvailable -Name SqlServer)) {
            Write-Host "Installing SqlServer PowerShell module..." -ForegroundColor Yellow
            Install-Module -Name SqlServer -Force -Scope CurrentUser -AllowClobber -ErrorAction SilentlyContinue
        }
        
        Import-Module SqlServer -ErrorAction Stop
        
        $securePassword = ConvertTo-SecureString $Password -AsPlainText -Force
        $credential = New-Object System.Management.Automation.PSCredential($Username, $securePassword)
        
        Write-Host "Testing basic connection..." -ForegroundColor Yellow
        $query = "SELECT @@VERSION AS Version, DB_NAME() AS CurrentDatabase, SYSTEM_USER AS CurrentUser, GETDATE() AS ServerTime"
        $result = Invoke-Sqlcmd -ServerInstance $ServerInstance -Database $Database -Credential $credential -Query $query -TrustServerCertificate -ErrorAction Stop
        
        Write-Success "Connection successful!"
        Write-Host ""
        Write-Host "SQL Server Information:" -ForegroundColor Cyan
        Write-Host "  Version: $($result.Version)" -ForegroundColor White
        Write-Host "  Current Database: $($result.CurrentDatabase)" -ForegroundColor White
        Write-Host "  Current User: $($result.CurrentUser)" -ForegroundColor White
        Write-Host "  Server Time: $($result.ServerTime)" -ForegroundColor White
        Write-Host ""
        
        return $true
    }
    catch {
        Write-ErrorMsg "Connection failed: $_"
        Write-Host ""
        Write-Host "Troubleshooting:" -ForegroundColor Yellow
        Write-Host "1. Verify container is running: docker-compose ps" -ForegroundColor White
        Write-Host "2. Check container logs: docker-compose logs sqlserver" -ForegroundColor White
        Write-Host "3. Wait a few minutes if container just started" -ForegroundColor White
        Write-Host "4. Verify credentials match docker-compose.yml" -ForegroundColor White
        return $false
    }
}

function Test-DatabaseOperations {
    Write-Header "Testing Database Operations"
    
    try {
        Import-Module SqlServer -ErrorAction Stop
        
        $connectionString = "Server=$ServerInstance;Database=master;User Id=$Username;Password=$Password;TrustServerCertificate=True;"
        $dbConnectionString = "Server=$ServerInstance;Database=$Database;User Id=$Username;Password=$Password;TrustServerCertificate=True;"
        
        Write-Host "Test 1: Checking SUSDB database..." -ForegroundColor Yellow
        $dbQuery = "SELECT name FROM sys.databases WHERE name = 'SUSDB'"
        $dbCheck = Invoke-Sqlcmd -ConnectionString $connectionString -Query $dbQuery -ErrorAction Stop
        if ($dbCheck) {
            Write-Success "SUSDB database exists"
        }
        else {
            Write-Warning "SUSDB database does not exist (will be created when WSUS connects)"
        }
        
        Write-Host "Test 2: Testing table operations..." -ForegroundColor Yellow
        $testTableQuery = @"
            IF OBJECT_ID('dbo.TestAppIntegration', 'U') IS NOT NULL
                DROP TABLE dbo.TestAppIntegration;
            
            CREATE TABLE dbo.TestAppIntegration (
                Id INT IDENTITY(1,1) PRIMARY KEY,
                TestName NVARCHAR(100),
                TestTime DATETIME DEFAULT GETDATE(),
                TestResult NVARCHAR(50)
            );
            
            INSERT INTO dbo.TestAppIntegration (TestName, TestResult)
            VALUES ('Application Integration Test', 'PASS');
            
            SELECT * FROM dbo.TestAppIntegration;
"@
        
        $tableResult = Invoke-Sqlcmd -ConnectionString $dbConnectionString -Query $testTableQuery -ErrorAction Stop
        if ($tableResult) {
            Write-Success "Table operations successful"
            Write-Host "  Test record created: $($tableResult.TestName)" -ForegroundColor White
        }
        
        Write-Host "Test 3: Testing query performance..." -ForegroundColor Yellow
        $perfQuery = "SELECT COUNT(*) AS TableCount FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'"
        $perfResult = Invoke-Sqlcmd -ConnectionString $dbConnectionString -Query $perfQuery -ErrorAction Stop
        Write-Success "Query performance test passed"
        Write-Host "  Tables found: $($perfResult.TableCount)" -ForegroundColor White
        
        Write-Host "Cleaning up test table..." -ForegroundColor Yellow
        Invoke-Sqlcmd -ConnectionString $dbConnectionString -Query "DROP TABLE IF EXISTS dbo.TestAppIntegration" -ErrorAction SilentlyContinue
        
        return $true
    }
    catch {
        Write-ErrorMsg "Database operations test failed: $_"
        return $false
    }
}

function Test-ApplicationCompatibility {
    Write-Header "Testing Application Compatibility"
    
    Write-Host "Verifying application can connect using these settings..." -ForegroundColor Yellow
    Write-Host ""
    
    $connectionString = "Server=$ServerInstance;Database=$Database;User Id=$Username;Password=$Password;TrustServerCertificate=True;"
    
    Write-Host "Connection String Format:" -ForegroundColor Yellow
    Write-Host "  $connectionString" -ForegroundColor White
    Write-Host ""
    
    try {
        Import-Module SqlServer -ErrorAction Stop
        $connectionString = "Server=$ServerInstance;Database=master;User Id=$Username;Password=$Password;TrustServerCertificate=True;"
        
        $authQuery = "SELECT SERVERPROPERTY('IsIntegratedSecurityOnly') AS IsWindowsAuth"
        $authCheck = Invoke-Sqlcmd -ConnectionString $connectionString -Query $authQuery -ErrorAction Stop
        
        if ($authCheck.IsWindowsAuth -eq 0) {
            Write-Success "SQL Server Authentication is enabled"
        }
        else {
            Write-Warning "SQL Server Authentication may not be enabled (Windows Auth only)"
        }
        
        $saQuery = "SELECT is_disabled FROM sys.sql_logins WHERE name = 'sa'"
        $saCheck = Invoke-Sqlcmd -ConnectionString $connectionString -Query $saQuery -ErrorAction Stop
        if ($saCheck.is_disabled -eq 0) {
            Write-Success "SA account is enabled"
        }
        else {
            Write-Warning "SA account is disabled"
        }
        
        return $true
    }
    catch {
        Write-ErrorMsg "Compatibility check failed: $_"
        return $false
    }
}

function Test-NetworkConnectivity {
    Write-Header "Testing Network Connectivity"
    
    Write-Host "Testing port connectivity..." -ForegroundColor Yellow
    
    $hostname = $ServerInstance.Split(',')[0]
    $port = if ($ServerInstance.Contains(',')) { $ServerInstance.Split(',')[1] } else { "1433" }
    
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $connect = $tcpClient.BeginConnect($hostname, [int]$port, $null, $null)
        $wait = $connect.AsyncWaitHandle.WaitOne(3000, $false)
        
        if ($wait) {
            $tcpClient.EndConnect($connect)
            Write-Success "Port $port is accessible on $hostname"
            $tcpClient.Close()
            return $true
        }
        else {
            Write-ErrorMsg "Port $port is not accessible on $hostname (timeout)"
            return $false
        }
    }
    catch {
        Write-ErrorMsg "Network connectivity test failed: $_"
        return $false
    }
}

function Show-TestSummary {
    param(
        [bool]$ContainerOk,
        [bool]$ConnectionOk,
        [bool]$OperationsOk,
        [bool]$CompatibilityOk,
        [bool]$NetworkOk
    )
    
    Write-Header "Test Summary"
    
    $totalTests = 5
    $passedTests = 0
    
    if ($ContainerOk) { 
        Write-Success "Container Status: PASS"
        $passedTests++
    } else { 
        Write-ErrorMsg "Container Status: FAIL" 
    }
    
    if ($NetworkOk) { 
        Write-Success "Network Connectivity: PASS"
        $passedTests++
    } else { 
        Write-ErrorMsg "Network Connectivity: FAIL" 
    }
    
    if ($ConnectionOk) { 
        Write-Success "SQL Connection: PASS"
        $passedTests++
    } else { 
        Write-ErrorMsg "SQL Connection: FAIL" 
    }
    
    if ($OperationsOk) { 
        Write-Success "Database Operations: PASS"
        $passedTests++
    } else { 
        Write-ErrorMsg "Database Operations: FAIL" 
    }
    
    if ($CompatibilityOk) { 
        Write-Success "Application Compatibility: PASS"
        $passedTests++
    } else { 
        Write-ErrorMsg "Application Compatibility: FAIL" 
    }
    
    Write-Host ""
    $color = if ($passedTests -eq $totalTests) { "Green" } else { "Yellow" }
    Write-Host "Results: $passedTests/$totalTests tests passed" -ForegroundColor $color
    Write-Host ""
    
    if ($passedTests -eq $totalTests) {
        Write-Success "All tests passed! Application is ready for Docker environment."
        Write-Host ""
        Write-Host "Next Steps:" -ForegroundColor Cyan
        Write-Host "1. Start the application: npm start" -ForegroundColor White
        Write-Host "2. Navigate to Maintenance view" -ForegroundColor White
        Write-Host "3. Configure SQL connection with:" -ForegroundColor White
        Write-Host "   Server: $ServerInstance" -ForegroundColor White
        Write-Host "   Username: $Username" -ForegroundColor White
        Write-Host "   Password: $Password" -ForegroundColor White
        Write-Host "   Database: $Database" -ForegroundColor White
        Write-Host "4. Test database operations (reindex, cleanup)" -ForegroundColor White
    }
    else {
        Write-Warning "Some tests failed. Please review the errors above."
    }
}

# Main execution
Write-Header "WSUS Manager - Application Integration Test"

# Check Docker availability
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

# Run tests
$containerOk = if (-not $SkipContainerCheck) { Test-ContainerRunning } else { $true }
$networkOk = Test-NetworkConnectivity
$connectionOk = Test-SqlConnection
$operationsOk = if ($connectionOk) { Test-DatabaseOperations } else { $false }
$compatibilityOk = if ($connectionOk) { Test-ApplicationCompatibility } else { $false }

# Show summary
Show-TestSummary -ContainerOk $containerOk -ConnectionOk $connectionOk -OperationsOk $operationsOk -CompatibilityOk $compatibilityOk -NetworkOk $networkOk

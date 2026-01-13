# Docker Setup Validation Script
# Validates all Docker configuration files and scripts without requiring Docker to be installed

param(
    [Parameter(Mandatory=$false)]
    [switch]$Detailed
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

function Test-DockerFiles {
    Write-Header "Validating Docker Configuration Files"
    
    $projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    $allGood = $true
    
    $composeFile = Join-Path $projectRoot "docker-compose.yml"
    if (Test-Path $composeFile) {
        Write-Success "docker-compose.yml exists"
        
        if ($Detailed) {
            $content = Get-Content $composeFile -Raw
            if ($content -match "sqlserver") {
                Write-Success "  Contains sqlserver service definition"
            }
            if ($content -match "1433:1433") {
                Write-Success "  Port mapping configured (1433:1433)"
            }
            if ($content -match "MSSQL_SA_PASSWORD") {
                Write-Success "  SA password configuration found"
            }
        }
    } else {
        Write-Error "docker-compose.yml not found"
        $allGood = $false
    }
    
    $initDir = Join-Path $projectRoot "docker\sql\init"
    if (Test-Path $initDir) {
        Write-Success "SQL init scripts directory exists"
        
        $init1 = Join-Path $initDir "01-init-susdb.sql"
        $init2 = Join-Path $initDir "02-setup-permissions.sql"
        
        if (Test-Path $init1) {
            Write-Success "  01-init-susdb.sql found"
        } else {
            Write-Error "  01-init-susdb.sql missing"
            $allGood = $false
        }
        
        if (Test-Path $init2) {
            Write-Success "  02-setup-permissions.sql found"
        } else {
            Write-Error "  02-setup-permissions.sql missing"
            $allGood = $false
        }
    } else {
        Write-Error "SQL init scripts directory not found"
        $allGood = $false
    }
    
    $scriptsDir = Join-Path $projectRoot "docker\scripts"
    $requiredScripts = @(
        "setup-docker.ps1",
        "start-lab.ps1",
        "test-connection.ps1",
        "test-app-integration.ps1"
    )
    
    foreach ($script in $requiredScripts) {
        $scriptPath = Join-Path $scriptsDir $script
        if (Test-Path $scriptPath) {
            Write-Success "$script exists"
        } else {
            Write-Error "$script missing"
            $allGood = $false
        }
    }
    
    return $allGood
}

function Test-ScriptSyntax {
    Write-Header "Validating PowerShell Script Syntax"
    
    $projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    $scriptsDir = Join-Path $projectRoot "docker\scripts"
    $allGood = $true
    
    $scripts = @(
        "setup-docker.ps1",
        "start-lab.ps1",
        "test-connection.ps1",
        "test-app-integration.ps1"
    )
    
    foreach ($script in $scripts) {
        $scriptPath = Join-Path $scriptsDir $script
        if (Test-Path $scriptPath) {
            try {
                $null = [System.Management.Automation.PSParser]::Tokenize((Get-Content $scriptPath -Raw), [ref]$null)
                Write-Success "$script - Syntax valid"
            }
            catch {
                Write-Error "$script - Syntax error: $_"
                $allGood = $false
            }
        }
    }
    
    return $allGood
}

function Test-NpmScripts {
    Write-Header "Validating npm Scripts"
    
    $projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    $packageJson = Join-Path $projectRoot "package.json"
    
    if (Test-Path $packageJson) {
        $package = Get-Content $packageJson | ConvertFrom-Json
        
        $requiredScripts = @(
            "docker:start",
            "docker:stop",
            "docker:test:app",
            "test:docker"
        )
        
        $allGood = $true
        foreach ($script in $requiredScripts) {
            if ($package.scripts.PSObject.Properties.Name -contains $script) {
                Write-Success "npm run $script - Configured"
            } else {
                Write-Error "npm run $script - Missing"
                $allGood = $false
            }
        }
        
        return $allGood
    } else {
        Write-Error "package.json not found"
        return $false
    }
}

function Test-DockerAvailability {
    Write-Header "Checking Docker Availability"
    
    try {
        $dockerVersion = docker --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Docker is installed: $dockerVersion"
            
            try {
                docker ps | Out-Null
                if ($LASTEXITCODE -eq 0) {
                    Write-Success "Docker daemon is running"
                    return $true
                } else {
                    Write-Warning "Docker daemon is not running"
                    return $false
                }
            }
            catch {
                Write-Warning "Docker daemon is not running"
                return $false
            }
        }
    }
    catch {
        Write-Warning "Docker is not installed or not in PATH"
        Write-Host "Install Docker Desktop from: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
        return $false
    }
    
    return $false
}

function Show-Summary {
    param(
        [bool]$FilesOk,
        [bool]$SyntaxOk,
        [bool]$NpmOk,
        [bool]$DockerOk
    )
    
    Write-Header "Validation Summary"
    
    $totalChecks = 4
    $passedChecks = 0
    
    if ($FilesOk) { 
        Write-Success "Configuration Files: PASS"
        $passedChecks++
    } else { 
        Write-Error "Configuration Files: FAIL" 
    }
    
    if ($SyntaxOk) { 
        Write-Success "Script Syntax: PASS"
        $passedChecks++
    } else { 
        Write-Error "Script Syntax: FAIL" 
    }
    
    if ($NpmOk) { 
        Write-Success "npm Scripts: PASS"
        $passedChecks++
    } else { 
        Write-Error "npm Scripts: FAIL" 
    }
    
    if ($DockerOk) { 
        Write-Success "Docker Availability: PASS"
        $passedChecks++
    } else { 
        Write-Warning "Docker Availability: NOT INSTALLED (expected if Docker not set up yet)" 
    }
    
    Write-Host ""
    $color = if ($passedChecks -ge 3) { "Green" } else { "Yellow" }
    Write-Host "Results: $passedChecks/$totalChecks checks passed" -ForegroundColor $color
    Write-Host ""
    
    if ($passedChecks -ge 3) {
        Write-Success "Docker setup is ready!"
        if (-not $DockerOk) {
            Write-Host ""
            Write-Host "Next Steps:" -ForegroundColor Cyan
            Write-Host "1. Install Docker Desktop" -ForegroundColor White
            Write-Host "2. Start Docker Desktop" -ForegroundColor White
            Write-Host "3. Run: npm run docker:setup" -ForegroundColor White
        } else {
            Write-Host ""
            Write-Host "Ready to test! Run: npm run docker:test:app" -ForegroundColor Cyan
        }
    }
    else {
        Write-Warning "Some validation checks failed. Please review the errors above."
    }
}

# Main execution
Write-Header "WSUS Manager - Docker Setup Validation"

$filesOk = Test-DockerFiles
$syntaxOk = Test-ScriptSyntax
$npmOk = Test-NpmScripts
$dockerOk = Test-DockerAvailability

Show-Summary -FilesOk $filesOk -SyntaxOk $syntaxOk -NpmOk $npmOk -DockerOk $dockerOk

# WSUS Test Runner
# Installs Pester if needed and runs WSUS mock tests

param(
    [switch]$Verbose,
    [switch]$CodeCoverage
)

$ErrorActionPreference = "Stop"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "GA-WsusManager Pro - WSUS Mock Tests" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check/Install Pester
$pesterModule = Get-Module -ListAvailable -Name Pester | Where-Object { $_.Version -ge [Version]"5.0.0" }
if (-not $pesterModule) {
    Write-Host "Installing Pester 5.x..." -ForegroundColor Yellow
    Install-Module -Name Pester -Force -SkipPublisherCheck -MinimumVersion 5.0.0 -Scope CurrentUser
}

Import-Module Pester -MinimumVersion 5.0.0

# Configure Pester
$config = New-PesterConfiguration
$config.Run.Path = "$PSScriptRoot\WSUS.Tests.ps1"
$config.Output.Verbosity = if ($Verbose) { "Detailed" } else { "Normal" }
$config.TestResult.Enabled = $true
$config.TestResult.OutputPath = "$PSScriptRoot\TestResults.xml"
$config.TestResult.OutputFormat = "NUnitXml"

if ($CodeCoverage) {
    $config.CodeCoverage.Enabled = $true
}

# Run tests
Write-Host "Running WSUS Mock Tests..." -ForegroundColor Green
Write-Host ""

$results = Invoke-Pester -Configuration $config

# Summary
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan  
Write-Host "=========================================" -ForegroundColor Cyan

# Check Pester result - FailedCount is the key property
$failedCount = $results.FailedCount
if ($null -eq $failedCount) {
    # Pester 5.x fallback - check Result property
    $failedCount = if ($results.Result -eq 'Failed') { 1 } else { 0 }
}

Write-Host ""
if ($failedCount -gt 0) {
    Write-Host "TESTS FAILED! ($failedCount failures)" -ForegroundColor Red
    exit 1
} else {
    Write-Host "ALL TESTS PASSED!" -ForegroundColor Green
    exit 0
}

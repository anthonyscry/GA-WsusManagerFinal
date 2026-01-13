# Setup AI Agents Configuration for New Worktree/Project
# PowerShell script for Windows

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

Write-Host "🚀 Setting up AI Development Team Agents..." -ForegroundColor Cyan

# Check if AI_AGENTS.md exists
if (-not (Test-Path "$ProjectRoot\AI_AGENTS.md")) {
    Write-Host "⚠️  AI_AGENTS.md not found. Please ensure it exists in project root" -ForegroundColor Yellow
    exit 1
}

# Ensure .cursor directory exists
$CursorDir = "$ProjectRoot\.cursor"
if (-not (Test-Path $CursorDir)) {
    New-Item -ItemType Directory -Path $CursorDir -Force | Out-Null
    Write-Host "✅ Created .cursor directory" -ForegroundColor Green
}

# Copy agents.json if it doesn't exist
$AgentsJson = "$ProjectRoot\.cursor\agents.json"
if (-not (Test-Path $AgentsJson)) {
    $TemplateJson = "$ScriptDir\agents.json"
    if (Test-Path $TemplateJson) {
        Copy-Item $TemplateJson $AgentsJson
        Write-Host "✅ Created .cursor\agents.json" -ForegroundColor Green
    } else {
        Write-Host "⚠️  agents.json template not found in .cursor directory" -ForegroundColor Yellow
    }
}

# Update worktrees.json
$WorktreesJson = "$ProjectRoot\.cursor\worktrees.json"
if (Test-Path $WorktreesJson) {
    Write-Host "✅ Found existing .cursor\worktrees.json" -ForegroundColor Green
    $WorktreesContent = Get-Content $WorktreesJson -Raw | ConvertFrom-Json
    
    if (-not $WorktreesContent.'ai-agents') {
        Write-Host "📝 Adding AI agents configuration to worktrees.json..." -ForegroundColor Yellow
        $WorktreesContent | Add-Member -MemberType NoteProperty -Name 'ai-agents' -Value @{
            enabled = $true
            configFile = ".cursor/agents.json"
            promptFile = "AI_AGENTS.md"
            autoActivate = $true
            defaultAgent = "project-lead"
        } -Force
        $WorktreesContent | ConvertTo-Json -Depth 10 | Set-Content $WorktreesJson
        Write-Host "✅ Updated worktrees.json with AI agents config" -ForegroundColor Green
    }
} else {
    Write-Host "📝 Creating .cursor\worktrees.json..." -ForegroundColor Yellow
    $WorktreesConfig = @{
        "setup-worktree" = @("npm install")
        "ai-agents" = @{
            enabled = $true
            configFile = ".cursor/agents.json"
            promptFile = "AI_AGENTS.md"
            autoActivate = $true
            defaultAgent = "project-lead"
        }
    }
    $WorktreesConfig | ConvertTo-Json -Depth 10 | Set-Content $WorktreesJson
    Write-Host "✅ Created .cursor\worktrees.json" -ForegroundColor Green
}

Write-Host ""
Write-Host "✅ AI Agents setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Open Cursor Settings → Custom Instructions"
Write-Host "   2. Copy the Project Lead prompt from AI_AGENTS.md"
Write-Host "   3. Or use the agent selector in Cursor to switch agents"
Write-Host ""
Write-Host "📖 Available agents:" -ForegroundColor Cyan
Write-Host "   • Project Lead (default)"
Write-Host "   • Code Validator"
Write-Host "   • Refactoring Architect"
Write-Host "   • Debugger"
Write-Host "   • QA Engineer"
Write-Host "   • Security Analyst"
Write-Host "   • DevOps Engineer"
Write-Host "   • Documentation Specialist"
Write-Host "   • UI/UX Specialist"
Write-Host "   • Database Architect"
Write-Host "   • Performance Engineer"
Write-Host "   • Integration Specialist"
Write-Host ""

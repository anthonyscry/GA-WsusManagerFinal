# 🤖 AI Agents Worktree Configuration

This directory contains a complete, reusable configuration system for the AI Development Team agents that can be deployed across all your projects and worktrees.

## ✨ What's Included

### Configuration Files
- **`agents.json`** - Complete agent definitions for all 12 agents
- **`worktrees.json`** - Enhanced worktree configuration with AI agent settings

### Setup Scripts
- **`setup-agents.ps1`** - Windows PowerShell setup script
- **`setup-agents.sh`** - Linux/Mac Bash setup script

### Documentation
- **`WORKTREE_SETUP.md`** - Complete setup and usage guide
- **`QUICK_REFERENCE.md`** - Quick reference for common tasks
- **`README.md`** - This file

## 🚀 Quick Start

### For This Project
Everything is already set up! The AI agents are configured and ready to use.

### For New Projects/Worktrees

**Windows:**
```powershell
# Copy the .cursor directory and AI_AGENTS.md to your new project
cp -r .cursor <new-project>/
cp AI_AGENTS.md <new-project>/

# Run setup script
cd <new-project>
.\.cursor\setup-agents.ps1
```

**Linux/Mac:**
```bash
# Copy the .cursor directory and AI_AGENTS.md to your new project
cp -r .cursor <new-project>/
cp AI_AGENTS.md <new-project>/

# Run setup script
cd <new-project>
chmod +x .cursor/setup-agents.sh
.cursor/setup-agents.sh
```

## 📋 How It Works

1. **`AI_AGENTS.md`** (in project root) contains all agent prompts
2. **`.cursor/agents.json`** defines which agents are available and their configuration
3. **`.cursor/worktrees.json`** tells Cursor to use the agent system
4. **Setup scripts** automate the initialization process

## 🎯 Using Agents

1. Open Cursor Settings → Custom Instructions
2. Copy the desired agent prompt from `AI_AGENTS.md`
3. Paste and save
4. Start coding with your AI agent!

## 📚 Documentation

- **Quick Reference**: See `.cursor/QUICK_REFERENCE.md` for common tasks
- **Full Guide**: See `.cursor/WORKTREE_SETUP.md` for complete documentation
- **Agent Prompts**: See `AI_AGENTS.md` in project root for all agent definitions

## 🔄 Maintaining Across Projects

### Update All Projects
1. Update `AI_AGENTS.md` with new prompts
2. Update `.cursor/agents.json` if agent structure changes
3. Run setup script on each project to sync

### Single Source Template
Keep a master copy of:
- `AI_AGENTS.md`
- `.cursor/` directory

Copy to each new project/worktree as needed.

## ✅ Verification

Check that setup is complete:
```bash
# All these should exist
test -f AI_AGENTS.md
test -f .cursor/agents.json
test -f .cursor/worktrees.json
```

## 🎨 Customization

Edit `.cursor/agents.json` to:
- Enable/disable specific agents per project
- Change the default agent
- Add project-specific agent rules
- Modify auto-selection behavior

---

**Version**: 1.0  
**Status**: ✅ Ready for use across all projects/worktrees

# 🚀 AI Agents Worktree Configuration

This directory contains the configuration for the AI Development Team agents system that can be used across all your projects and worktrees.

## 📁 Files

- **`agents.json`** - Agent definitions and configuration
- **`worktrees.json`** - Worktree-specific settings including AI agent activation
- **`setup-agents.sh`** - Bash script to initialize agents in a new project (Linux/Mac)
- **`setup-agents.ps1`** - PowerShell script to initialize agents in a new project (Windows)
- **`WORKTREE_SETUP.md`** - This documentation file

## 🎯 Quick Setup for New Projects

### Option 1: Automatic Setup (Recommended)

**Windows (PowerShell):**
```powershell
cd <your-project-root>
.\.cursor\setup-agents.ps1
```

**Linux/Mac (Bash):**
```bash
cd <your-project-root>
chmod +x .cursor/setup-agents.sh
.cursor/setup-agents.sh
```

### Option 2: Manual Setup

1. **Copy AI_AGENTS.md to project root**
   ```bash
   cp AI_AGENTS.md <new-project-root>/
   ```

2. **Copy .cursor directory**
   ```bash
   cp -r .cursor <new-project-root>/
   ```

3. **Verify configuration**
   - Ensure `AI_AGENTS.md` exists in project root
   - Ensure `.cursor/agents.json` exists
   - Ensure `.cursor/worktrees.json` has `ai-agents` section

## 📋 Configuration Structure

### `.cursor/worktrees.json`
```json
{
  "setup-worktree": ["npm install"],
  "ai-agents": {
    "enabled": true,
    "configFile": ".cursor/agents.json",
    "promptFile": "AI_AGENTS.md",
    "autoActivate": true,
    "defaultAgent": "project-lead"
  }
}
```

### `.cursor/agents.json`
Contains all 12 agent definitions with:
- Agent name and role
- Reference to prompt section in `AI_AGENTS.md`
- Priority and enabled status
- Auto-selection rules

## 🔧 Using Agents in Cursor

### Method 1: Custom Instructions
1. Open Cursor Settings → Custom Instructions
2. Copy the agent prompt from `AI_AGENTS.md` (between `═══ START COPY ═══` markers)
3. Paste into Custom Instructions
4. Save and start using

### Method 2: Agent Selector (if supported)
- Use Cursor's agent selector to switch between agents
- Agents are context-aware and auto-select based on task type

### Method 3: Direct Reference
- Reference agents in chat: "Act as the Code Validator agent"
- The system will load the appropriate prompt from `AI_AGENTS.md`

## 📑 Available Agents

| Agent | Key | Use Case |
|-------|-----|----------|
| Project Lead | `project-lead` | Orchestration, decisions, coordination |
| Code Validator | `code-validator` | Syntax errors, security scans |
| Refactoring Architect | `refactoring-architect` | Code structure, modularization |
| Debugger | `debugger` | Bug fixes, root cause analysis |
| QA Engineer | `qa-engineer` | Testing, quality gates |
| Security Analyst | `security-analyst` | Vulnerabilities, hardening |
| DevOps Engineer | `devops-engineer` | CI/CD, deployment |
| Documentation Specialist | `documentation-specialist` | Docs, comments, guides |
| UI/UX Specialist | `ui-ux-specialist` | Interface, accessibility |
| Database Architect | `database-architect` | Data modeling, queries |
| Performance Engineer | `performance-engineer` | Optimization, speed |
| Integration Specialist | `integration-specialist` | APIs, webhooks |

## 🔄 Updating Agents Across Projects

### Single Source of Truth
- Keep `AI_AGENTS.md` in a central location
- Copy to each project that needs it
- Or use a shared location and symlink

### Updating Configuration
1. Update `AI_AGENTS.md` with new prompts
2. Update `.cursor/agents.json` if agent structure changes
3. Run setup script on each project to sync changes

## 🎨 Customization

### Project-Specific Agents
Edit `.cursor/agents.json` to:
- Disable agents not needed for the project
- Add project-specific agent rules
- Modify auto-selection behavior

### Custom Agent Prompts
1. Add new agent section to `AI_AGENTS.md`
2. Add agent definition to `.cursor/agents.json`
3. Reference in `worktrees.json` if needed

## 📝 Best Practices

1. **Start with Project Lead** - Always begin with the Project Lead agent
2. **Switch as needed** - Use specialized agents for specific tasks
3. **Keep prompts updated** - Regularly update `AI_AGENTS.md` with improvements
4. **Version control** - Commit agent configurations to your repository
5. **Document customizations** - Note any project-specific agent modifications

## 🐛 Troubleshooting

### Agents not loading
- Verify `AI_AGENTS.md` exists in project root
- Check `.cursor/agents.json` syntax is valid JSON
- Ensure `.cursor/worktrees.json` has `ai-agents` section

### Prompts not working
- Verify section markers (`═══ START COPY ═══`) are correct
- Check agent name matches in `agents.json`
- Ensure prompt file path is correct

### Setup script fails
- Check file permissions (make scripts executable)
- Verify paths are correct
- Ensure required files exist before running

## 📚 Additional Resources

- See `AI_AGENTS.md` for complete agent prompts
- Each agent section includes detailed instructions
- Quick Start guide is at the end of `AI_AGENTS.md`

---

**Version**: 1.0  
**Last Updated**: 2024  
**Maintained By**: AI Development Team System

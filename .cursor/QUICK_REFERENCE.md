# ⚡ AI Agents Quick Reference

## 🚀 Setup New Project (30 seconds)

**Windows:**
```powershell
.\.cursor\setup-agents.ps1
```

**Linux/Mac:**
```bash
chmod +x .cursor/setup-agents.sh && .cursor/setup-agents.sh
```

## 📋 Copy to New Worktree

```bash
# From your template project
cp AI_AGENTS.md <new-worktree-root>/
cp -r .cursor <new-worktree-root>/
```

## 🎯 Use an Agent

1. **Open Cursor Settings → Custom Instructions**
2. **Copy agent prompt** from `AI_AGENTS.md`:
   - Find section: `TAB X: [AGENT NAME]`
   - Copy between `═══ START COPY ═══` markers
3. **Paste and save**

## 🔄 Switch Agents

| Need | Agent | Section in AI_AGENTS.md |
|------|-------|------------------------|
| General work | Project Lead | TAB 1 |
| Fix errors | Code Validator | TAB 2 |
| Clean code | Refactoring Architect | TAB 3 |
| Fix bugs | Debugger | TAB 4 |
| Write tests | QA Engineer | TAB 5 |
| Security check | Security Analyst | TAB 6 |
| Deploy | DevOps Engineer | TAB 7 |
| Write docs | Documentation Specialist | TAB 8 |
| UI work | UI/UX Specialist | TAB 9 |
| Database | Database Architect | TAB 10 |
| Performance | Performance Engineer | TAB 11 |
| APIs | Integration Specialist | TAB 12 |

## 📁 Required Files

```
project-root/
├── AI_AGENTS.md              # All agent prompts
└── .cursor/
    ├── agents.json           # Agent definitions
    ├── worktrees.json        # Worktree config
    ├── setup-agents.sh       # Setup script (Unix)
    ├── setup-agents.ps1      # Setup script (Windows)
    └── WORKTREE_SETUP.md    # Full documentation
```

## ✅ Verify Setup

```bash
# Check files exist
test -f AI_AGENTS.md && echo "✅ AI_AGENTS.md"
test -f .cursor/agents.json && echo "✅ agents.json"
test -f .cursor/worktrees.json && echo "✅ worktrees.json"
```

## 🎨 Customize

Edit `.cursor/agents.json` to:
- Enable/disable specific agents
- Change default agent
- Modify auto-selection rules

---

**Need help?** See `.cursor/WORKTREE_SETUP.md` for full documentation.

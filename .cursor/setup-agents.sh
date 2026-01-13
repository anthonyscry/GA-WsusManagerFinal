#!/bin/bash
# Setup AI Agents Configuration for New Worktree/Project
# This script initializes the AI agent system in a new project

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 Setting up AI Development Team Agents..."

# Check if AI_AGENTS.md exists
if [ ! -f "$PROJECT_ROOT/AI_AGENTS.md" ]; then
    echo "⚠️  AI_AGENTS.md not found. Creating from template..."
    # If you have a template location, copy it here
    # cp "$TEMPLATE_DIR/AI_AGENTS.md" "$PROJECT_ROOT/AI_AGENTS.md"
    echo "❌ Please ensure AI_AGENTS.md exists in project root"
    exit 1
fi

# Ensure .cursor directory exists
mkdir -p "$PROJECT_ROOT/.cursor"

# Copy agents.json if it doesn't exist
if [ ! -f "$PROJECT_ROOT/.cursor/agents.json" ]; then
    if [ -f "$SCRIPT_DIR/agents.json" ]; then
        cp "$SCRIPT_DIR/agents.json" "$PROJECT_ROOT/.cursor/agents.json"
        echo "✅ Created .cursor/agents.json"
    else
        echo "⚠️  agents.json template not found in .cursor directory"
    fi
fi

# Update worktrees.json
if [ -f "$PROJECT_ROOT/.cursor/worktrees.json" ]; then
    echo "✅ Found existing .cursor/worktrees.json"
    # Check if ai-agents section exists
    if ! grep -q "ai-agents" "$PROJECT_ROOT/.cursor/worktrees.json"; then
        echo "📝 Adding AI agents configuration to worktrees.json..."
        # This would require jq or manual editing
        echo "⚠️  Please manually add ai-agents section to worktrees.json"
    fi
else
    echo "📝 Creating .cursor/worktrees.json..."
    cat > "$PROJECT_ROOT/.cursor/worktrees.json" << 'EOF'
{
  "setup-worktree": [
    "npm install"
  ],
  "ai-agents": {
    "enabled": true,
    "configFile": ".cursor/agents.json",
    "promptFile": "AI_AGENTS.md",
    "autoActivate": true,
    "defaultAgent": "project-lead"
  }
}
EOF
    echo "✅ Created .cursor/worktrees.json"
fi

echo ""
echo "✅ AI Agents setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Open Cursor Settings → Custom Instructions"
echo "   2. Copy the Project Lead prompt from AI_AGENTS.md"
echo "   3. Or use the agent selector in Cursor to switch agents"
echo ""
echo "📖 Available agents:"
echo "   • Project Lead (default)"
echo "   • Code Validator"
echo "   • Refactoring Architect"
echo "   • Debugger"
echo "   • QA Engineer"
echo "   • Security Analyst"
echo "   • DevOps Engineer"
echo "   • Documentation Specialist"
echo "   • UI/UX Specialist"
echo "   • Database Architect"
echo "   • Performance Engineer"
echo "   • Integration Specialist"
echo ""

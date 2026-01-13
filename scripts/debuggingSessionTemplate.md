# Debugging Session Template
Copy this template for each new issue you're debugging.

---

```
═══════════════════════════════════════════════════════════════
DEBUGGING SESSION: [ISSUE-ID]
═══════════════════════════════════════════════════════════════

ISSUE ID: [TICKET-XXX]
REPORTED BY: [Name]
DATE FOUND: [YYYY-MM-DD]
STATUS: [New/Investigating/Root Cause Found/Fix In Progress/Fixed/Verified]

ISSUE SUMMARY:
[One line description]

STEPS TO REPRODUCE:
1. [Step 1]
2. [Step 2]
3. [Step 3]

EXPECTED BEHAVIOR:
[What should happen]

ACTUAL BEHAVIOR:
[What actually happens]

ERROR MESSAGES:
[Exact error text, stack traces]

───────────────────────────────────────────────────────────────

REPRODUCTION RESULT:
☐ Reproduced successfully
☐ Could not reproduce - need more info
☐ Intermittent - reproduced X/Y attempts (X%)

ENVIRONMENT:
- OS: [Windows version]
- Node.js: [version]
- Electron: [version]
- WSUS Service Status: [Running/Stopped]
- SQL Server Status: [Running/Stopped]

───────────────────────────────────────────────────────────────

ISOLATION FINDINGS:

Component: [Where bug lives]
  - File: [path/to/file.ts]
  - Function: [functionName]
  - Line(s): [line numbers]
  - Trigger: [What causes it]

Minimal Reproduction:
[Smallest code/input that reproduces the issue]

───────────────────────────────────────────────────────────────

ROOT CAUSE:
[Detailed explanation of why the bug occurred]

Timeline:
1. [What happens first]
2. [What happens next]
3. [Where it fails]
4. [Why it fails]

5 Whys Analysis:
- Why 1: [First why]
- Why 2: [Second why]
- Why 3: [Third why]
- Why 4: [Fourth why]
- Why 5: [Fifth why - root cause]

───────────────────────────────────────────────────────────────

FIX IMPLEMENTED:
[Description of changes made]

Files Modified:
- [file1.ts] (lines X-Y): [Description of change]
- [file2.ts] (lines X-Y): [Description of change]

Code Changes:
```diff
[Paste unified diff here]
```

───────────────────────────────────────────────────────────────

VERIFICATION:

Reproduction:
☐ Original steps now pass
☐ Intermittent issue resolved (tested X times)

Testing:
☐ Unit tests pass
☐ Integration tests pass
☐ Manual testing completed
☐ Edge cases verified

Regression:
☐ Related features still work
☐ No new warnings/errors introduced
☐ Performance not degraded
☐ Memory usage normal

───────────────────────────────────────────────────────────────

SIMILAR CODE CHECKED:
☐ Searched for similar patterns
☐ Found [X] other instances
☐ Fixed/logged as separate issues: [TICKET-YYY, TICKET-ZZZ]

───────────────────────────────────────────────────────────────

READY FOR:
☐ Code review
☐ QA verification
☐ Deployment

NOTES:
[Any additional notes, concerns, or follow-ups]

═══════════════════════════════════════════════════════════════
```

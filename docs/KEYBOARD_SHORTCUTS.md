# Keyboard Shortcuts

GA-WsusManager Pro supports keyboard navigation for efficient workflow.

## Global Shortcuts

| Shortcut | Action |
|----------|--------|
| `Tab` | Navigate to next focusable element |
| `Shift+Tab` | Navigate to previous focusable element |
| `Enter` / `Space` | Activate focused button or control |

## Navigation

| Shortcut | Action |
|----------|--------|
| `Tab` | Move through sidebar navigation items |
| `Enter` | Select navigation item |

## Dialogs & Modals

| Shortcut | Action |
|----------|--------|
| `Escape` | Close dialog/modal |
| `Tab` | Cycle through dialog controls (focus trap) |
| `Shift+Tab` | Cycle backwards through dialog controls |
| `Enter` | Confirm action (when confirm button focused) |

## Tables

| Shortcut | Action |
|----------|--------|
| `Tab` | Navigate through table controls |
| `Space` | Toggle checkbox selection |
| `Enter` | Activate row action |

## Terminal

| Shortcut | Action |
|----------|--------|
| `Enter` | Execute command |
| `Arrow Up/Down` | Navigate command history (when implemented) |

## Accessibility Notes

1. **Focus Indicators**: All interactive elements have visible focus indicators for keyboard users.

2. **Focus Trapping**: Modals and dialogs trap focus to prevent navigation outside while open.

3. **Screen Reader Support**:
   - All interactive elements have accessible labels
   - Status changes are announced via ARIA live regions
   - Icons have descriptive labels

4. **Skip Navigation**: Tab through the interface to reach main content quickly.

## Tips for Keyboard-Only Users

- Use `Tab` to navigate through all interactive elements
- Watch for the blue focus ring to see your current position
- Press `Escape` to close any open modal or dropdown
- In tables, use `Tab` to navigate between rows and action buttons

## Terminal Commands

The terminal accepts the following commands:

| Command | Description |
|---------|-------------|
| `help` | Show available commands |
| `status` | Display current WSUS status |
| `clear` | Clear terminal output |
| `ping <hostname>` | Test connectivity to a computer |
| `cleanup` | Run WSUS cleanup wizard |
| `reindex` | Reindex WSUS database |

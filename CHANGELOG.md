# Changelog

All notable changes to GA-WsusManager Pro will be documented in this file.

## [3.9.0] - 2026-01-13

### 🎯 Highlights
This release focuses on security hardening, test coverage, and user experience improvements.

### 🔐 Security
- **Encryption**: Session-based key derivation using PBKDF2 with 600,000 iterations (OWASP compliant)
- **PowerShell**: Context-aware command whitelisting prevents injection attacks
- **SQL**: Query validation with dangerous keyword blocking and parameterized queries
- **Electron**: Content Security Policy restricts resource loading
- **Passwords**: Proper escaping for PowerShell special characters

### ✅ Testing
- Added 109 unit tests covering critical functionality
- Domain entity tests (Computer, EnvironmentStats, ScheduledTask)
- Security tests for SQL validation, PowerShell sanitization, crypto utilities
- Use case integration tests with mock implementations
- Jest configuration with coverage thresholds

### ♿ Accessibility
- **Focus Trap**: `useFocusTrap` hook for modal keyboard navigation
- **Keyboard Shortcuts**: Full documentation in `docs/KEYBOARD_SHORTCUTS.md`
- **ARIA**: Proper labels and live regions for screen readers
- **Tab Navigation**: Logical focus order throughout the application

### 🎨 User Experience
- **Skeleton Loading**: Visual placeholders during data loading
- **Toast Notifications**: `useToast()` hook with friendly error messages
- **Retry Logic**: Exponential backoff for failed network operations
- **Error Messages**: User-friendly translations for technical errors

### 🐛 Bug Fixes
- Fixed `Computer.fromJSON()` status parsing using `parseHealthStatus`
- Added missing `react-is` dependency for recharts compatibility
- Fixed TypeScript errors in crypto utilities

### 📦 Build & CI
- GitHub Actions workflow for automated portable EXE builds
- Release workflow for version tagging and artifact publishing
- Adjusted Jest coverage thresholds for Electron app context

---

## [3.8.10] - 2026-01-13

### Security
- Comprehensive security audit and hardening
- Fixed hardcoded encryption key vulnerability
- Improved PowerShell command validation
- SQL injection prevention improvements

---

## [3.8.9] - 2026-01-12

### Features
- WSUS auto-approve/decline automation
- Rule-based update management

---

## [3.8.8] - 2026-01-11

### Features
- DISA STIG file scanner
- Automated deployment wizard
- Security compliance checking

---

## [3.8.7] - 2026-01-10

### Features
- UI layout improvements
- Real STIG compliance checks
- Task Scheduler integration

### Fixes
- Tailwind v4 configuration with @config directive
- SVG stroke styling for cross-platform compatibility

---

## [3.8.0 - 3.8.6]

### Features
- Clean Architecture implementation
- Dependency injection container
- Domain-driven design entities
- Bridge pattern for legacy compatibility
- React 19 upgrade
- Vite 6 build system

---

## Installation

Download the portable EXE from the releases page. No installation required.

### Requirements
- Windows Server 2016 or later
- WSUS role installed
- SQL Server Express (for database operations)
- Administrator privileges

### Usage
1. Download `GA-WsusManager.Pro.*.exe`
2. Run as Administrator
3. Connect to your WSUS server

---

## Contributing

See [CLAUDE.md](./CLAUDE.md) for development setup and architecture overview.

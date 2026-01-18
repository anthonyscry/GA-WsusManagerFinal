
# GA-WsusManager Pro (v3.8.9)

Standalone Portable WSUS Management Suite designed for GA-ASI Lab Environments.

## ✨ What's New in v3.8.9

### 🔐 Security Hardening (Completed)
- **Electron Security**: Enabled `contextIsolation: true` and disabled `nodeIntegration` to sandbox the renderer process.
- **Secure IPC**: Migrated all PowerShell execution to a secure IPC channel (`execute-powershell`) with server-side validation.
- **Build Integrity**: Integrated `preload.js` into the production build process.

### 🧪 Enhanced Test Infrastructure
- **Unit Testing**: 19 Jest unit tests covering core services and utilities.
- **E2E Testing**: 10 Playwright end-to-end tests for critical user flows.
- **PowerShell Testing**: 17 Pester mock tests for WSUS operation verification.

### 🏗️ Code Modularization
- **STIG Service**: Refactored into `services/stig/` (7 modular files) for better maintainability.
- **State Management**: Centralized into `services/state/` (6 specialized files).
- **WSUS Operations**: Organized within `services/wsus/` for dedicated update management.

## 🚀 Quick Start (Local Development)

1. **Install Node.js** (v20+ recommended)
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Run in Development Mode**:
   ```bash
   npm start
   ```

## 🛠 Building the Portable EXE

The project is configured with GitHub Actions. Simply push to `main` and download the artifact from the **Actions** tab.

To build manually on your machine:
```bash
npm run build:exe
```
The result will be in the `dist/` folder.

## 🧪 Testing

The project maintains high reliability through a multi-layered testing approach:

- **Unit Tests (Jest)**: 19 tests for core business logic and utility functions.
  ```bash
  npm test
  ```
- **E2E Tests (Playwright)**: 10 tests for user interface and workflow validation.
  ```bash
  npx playwright test
  ```
- **PowerShell Tests (Pester)**: 17 mock tests for WSUS command validation.
  ```bash
  powershell ./tests/powershell/Run-WSUSTests.ps1
  ```

## ⚠️ Troubleshooting Git Push Errors

If you see "Something went wrong" when pushing:
1. Ensure you have a `.gitignore` (added in v3.8.6).
2. If you are behind the GA proxy, configure git:
   ```bash
   git config --global http.proxy http://proxy.ga.com:8080
   ```
3. If you accidentally tracked `node_modules`, clear the cache:
   ```bash
   git rm -r --cached .
   git add .
   git commit -m "fix: apply gitignore"
   git push
   ```

## 🔐 Security Note

GA-WsusManager Pro follows the principle of least privilege:
- **Renderer Sandboxing**: `contextIsolation` is enabled and `nodeIntegration` is disabled for all renderer processes.
- **Secure IPC**: All privileged operations (PowerShell, File System) are mediated through a secure IPC bridge via `preload.js` with server-side validation in `main.js`.
- **Session Vault**: SQL credentials and encryption keys are stored in a non-persistent, session-based vault and are never transmitted externally.

## 🐛 Debugging Resources

This project includes comprehensive debugging documentation and tools:

- **[docs/debugging/DEBUGGING_INDEX.md](./docs/debugging/DEBUGGING_INDEX.md)** - Complete index of debugging resources
- **[docs/debugging/DEBUGGING_RUNBOOK.md](./docs/debugging/DEBUGGING_RUNBOOK.md)** - Comprehensive debugging methodology
- **[docs/debugging/DEBUGGING_QUICK_REFERENCE.md](./docs/debugging/DEBUGGING_QUICK_REFERENCE.md)** - One-page cheat sheet
- **Debugging Utilities**: `utils/debugHelpers.ts` - Helper functions for common debugging tasks
- **Debug Checklist**: `npm run debug:checklist` - Automated pre-debugging checks

For debugging issues, start with the **Quick Reference** guide, then use the **Runbook** for detailed methodology.

## 🐳 Lab Environment Setup

For testing this application in a complete lab environment with WSUS and SQL Server, see the [Docker Lab Environment Setup](./docker/README.md) documentation.

### Quick Start with Docker

**Automated Setup (Recommended):**
```powershell
# Full automated setup (checks Docker, starts containers, tests connection)
npm run docker:setup

# Or check Docker installation only
npm run docker:setup:check
```

**Manual Setup:**
```powershell
# Start SQL Server container
npm run docker:start

# Test connection
npm run test:docker

# View logs
npm run docker:logs
```

**Available Docker Commands:**
- `npm run docker:setup` - Full automated setup (checks Docker, starts container, initializes database)
- `npm run docker:setup:check` - Check Docker installation
- `npm run docker:start` - Start SQL Server container
- `npm run docker:start:init` - Start container and initialize database (recommended)
- `npm run docker:init` - Initialize SUSDB database (run after container starts)
- `npm run docker:stop` - Stop containers
- `npm run docker:restart` - Restart container
- `npm run docker:status` - Show container status
- `npm run docker:logs` - View container logs
- `npm run docker:test` - Start, initialize, and test connection
- `npm run docker:test:app` - Comprehensive integration test
- `npm run test:docker` - Test SQL connection only
- `npm run docker:down` - Stop and remove containers
- `npm run docker:clean` - Remove containers and volumes (⚠️ deletes data)
- `npm run docker:validate` - Validate Docker configuration

See [docker/SETUP_COMPLETE.md](./docker/SETUP_COMPLETE.md) for complete setup documentation.

## 📚 Documentation

All project documentation is organized in the [`docs/`](./docs/) directory:

- **Architecture**: [`docs/architecture/`](./docs/architecture/) - Architecture design and implementation guides
- **Refactoring**: [`docs/refactoring/`](./docs/refactoring/) - Refactoring progress and reports
- **Build**: [`docs/build/`](./docs/build/) - Build and deployment instructions
- **Testing**: [`docs/testing/`](./docs/testing/) - Testing documentation and results
- **Debugging**: [`docs/debugging/`](./docs/debugging/) - Debugging guides and resources
- **Reports**: [`docs/reports/`](./docs/reports/) - Project reports and status documents

See [`docs/README.md`](./docs/README.md) for a complete documentation index.

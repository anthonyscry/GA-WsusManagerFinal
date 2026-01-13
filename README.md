
# GA-WsusManager Pro (v3.8.6)

Standalone Portable WSUS Management Suite designed for GA-ASI Lab Environments.

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
Database operations require SQL SA credentials. These are stored in a non-persistent session vault (browser localStorage) and are never sent to external services.

## 🐛 Debugging Resources

This project includes comprehensive debugging documentation and tools:

- **[docs/debugging/DEBUGGING_INDEX.md](./docs/debugging/DEBUGGING_INDEX.md)** - Complete index of debugging resources
- **[docs/debugging/DEBUGGING_RUNBOOK.md](./docs/debugging/DEBUGGING_RUNBOOK.md)** - Comprehensive debugging methodology
- **[docs/debugging/DEBUGGING_QUICK_REFERENCE.md](./docs/debugging/DEBUGGING_QUICK_REFERENCE.md)** - One-page cheat sheet
- **Debugging Utilities**: `utils/debugHelpers.ts` - Helper functions for common debugging tasks
- **Debug Checklist**: `npm run debug:checklist` - Automated pre-debugging checks

For debugging issues, start with the **Quick Reference** guide, then use the **Runbook** for detailed methodology.

## 📚 Documentation

All project documentation is organized in the [`docs/`](./docs/) directory:

- **Architecture**: [`docs/architecture/`](./docs/architecture/) - Architecture design and implementation guides
- **Refactoring**: [`docs/refactoring/`](./docs/refactoring/) - Refactoring progress and reports
- **Build**: [`docs/build/`](./docs/build/) - Build and deployment instructions
- **Testing**: [`docs/testing/`](./docs/testing/) - Testing documentation and results
- **Debugging**: [`docs/debugging/`](./docs/debugging/) - Debugging guides and resources
- **Reports**: [`docs/reports/`](./docs/reports/) - Project reports and status documents

See [`docs/README.md`](./docs/README.md) for a complete documentation index.

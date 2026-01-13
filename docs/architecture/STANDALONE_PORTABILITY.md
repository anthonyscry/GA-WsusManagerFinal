# Standalone Portability Guide

## ✅ Standalone Portable App Guarantees

This application is designed as a **fully standalone portable app** with zero external runtime dependencies.

### Core Requirements Met

1. **✅ No External Runtime Dependencies**
   - All code bundled in Electron executable
   - No Node.js installation required
   - No npm/node_modules needed at runtime
   - Single EXE file runs anywhere

2. **✅ No Network Dependencies**
   - Works completely offline
   - Air-gap mode supported
   - No cloud services required
   - No internet connectivity needed

3. **✅ No Database Server Required**
   - Uses browser localStorage (built-in)
   - No SQL Server installation needed
   - No database configuration required
   - Data persists in user's profile

4. **✅ No Installation Required**
   - Portable EXE format
   - Can run from USB drive
   - No registry entries
   - No system modifications

5. **✅ Self-Contained**
   - All dependencies bundled
   - All assets included
   - All code compiled
   - Single executable

---

## 📦 Build Configuration

### Electron Builder Config

```json
{
  "build": {
    "appId": "com.ga-asi.wsusmanager",
    "productName": "GA-WsusManager Pro",
    "win": {
      "target": "portable",
      "sign": null
    }
  }
}
```

**Key Settings**:
- `target: "portable"` - Creates portable EXE
- `sign: null` - No code signing (for internal use)
- All files bundled in single executable

---

## 🔧 Runtime Environment

### What's Included

- ✅ Electron runtime (bundled)
- ✅ Chromium browser engine (bundled)
- ✅ Node.js runtime (bundled)
- ✅ React application (compiled)
- ✅ All TypeScript code (compiled to JS)
- ✅ All assets (images, styles, etc.)

### What's NOT Required

- ❌ Node.js installation
- ❌ npm package manager
- ❌ Internet connection
- ❌ Database server
- ❌ WSUS server (optional)
- ❌ SQL Server (optional)
- ❌ Docker (optional, for testing only)

---

## 💾 Data Storage

### localStorage Usage

- **Location**: Browser localStorage (Electron's storage)
- **Persistence**: Survives app restarts
- **Scope**: Per-user profile
- **Size Limit**: ~5-10MB (sufficient for app data)

### What's Stored

- Environment statistics
- Computer inventory
- Scheduled tasks
- User preferences
- Session data

### What's NOT Stored

- Passwords (session-only)
- Sensitive credentials (cleared on close)
- Large files (not supported)

---

## 🚀 Deployment

### Building Portable EXE

```bash
npm run build:exe
```

**Output**: `release/GA-WsusManager Pro.exe`

### Distribution

1. Copy EXE to target machine
2. Double-click to run
3. No installation needed
4. No admin rights required (unless accessing WSUS/SQL)

---

## 🔒 Security Considerations

### Standalone App Security

- ✅ No external API calls (except optional WSUS/SQL)
- ✅ Credentials stored in localStorage (session-only)
- ✅ Input validation on all commands
- ✅ Command whitelist enforced
- ✅ SQL injection protection

### Air-Gap Mode

- ✅ Works completely offline
- ✅ No network traffic
- ✅ No external connections
- ✅ Fully isolated

---

## ⚙️ Optional Features

### WSUS Server (Optional)

- App works without WSUS server
- Falls back to mock data
- Can connect when available
- No requirement for core functionality

### SQL Server (Optional)

- Database operations disabled if unavailable
- App continues to function
- Can connect when available
- No requirement for core functionality

### Docker (Optional)

- Only for testing environment
- Not required for app operation
- Development/testing tool only

---

## 📋 Portability Checklist

- [x] Single executable file
- [x] No installation required
- [x] No external dependencies
- [x] Works offline
- [x] No database server needed
- [x] No network required
- [x] Self-contained
- [x] Portable (USB-friendly)
- [x] No registry entries
- [x] No system modifications

---

## 🎯 Use Cases

### Scenario 1: Air-Gapped Environment

1. Copy EXE to USB drive
2. Transfer to air-gapped machine
3. Run EXE directly
4. App works fully offline

### Scenario 2: Portable Deployment

1. Copy EXE to network share
2. Users download and run
3. No IT installation needed
4. No configuration required

### Scenario 3: Testing Environment

1. Use Docker for WSUS/SQL (optional)
2. Run app EXE
3. Connect to test services
4. Full functionality available

---

## 🔍 Verification

### How to Verify Standalone Operation

1. **Build the EXE**:
   ```bash
   npm run build:exe
   ```

2. **Copy to clean machine** (no Node.js, no npm)

3. **Run EXE**:
   - Should launch immediately
   - Should work offline
   - Should persist data in localStorage

4. **Verify Features**:
   - Dashboard loads
   - Navigation works
   - Data persists between sessions
   - No errors about missing dependencies

---

## 📝 Notes

- **Windows Only**: Currently built for Windows (portable EXE)
- **PowerShell Required**: Uses Windows PowerShell (built-in)
- **localStorage**: Uses Electron's localStorage (browser API)
- **No Admin Required**: Runs as regular user (unless accessing WSUS/SQL)

---

**Status**: ✅ **FULLY STANDALONE PORTABLE APP**

All requirements met for standalone portable deployment.

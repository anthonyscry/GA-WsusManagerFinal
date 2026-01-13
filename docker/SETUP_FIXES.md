# Docker Setup Fixes - Summary

## Issues Fixed

### 1. ✅ Fixed docker-compose.yml
**Problem**: SQL Server containers don't support `/docker-entrypoint-initdb.d` volume mount (that's PostgreSQL/MySQL only)

**Solution**: Removed the incorrect volume mount. SQL Server initialization is now handled by a PowerShell script that runs after the container starts.

**Changes**:
- Removed: `./docker/sql/init:/docker-entrypoint-initdb.d` volume mount
- SQL initialization now handled by `docker/scripts/init-sqlserver.ps1`

### 2. ✅ Created SQL Server Initialization Script
**New File**: `docker/scripts/init-sqlserver.ps1`

**Features**:
- Waits for SQL Server to be ready (with retry logic)
- Runs initialization SQL scripts in correct order
- Handles errors gracefully
- Provides clear status messages

**Usage**:
```powershell
.\docker\scripts\init-sqlserver.ps1
# Or via npm:
npm run docker:init
```

### 3. ✅ Updated Setup Scripts
**Updated Files**:
- `docker/scripts/setup-docker.ps1` - Now calls initialization script
- `docker/scripts/start-lab.ps1` - Now calls initialization script
- `docker/scripts/test-app-integration.ps1` - Now calls initialization script

**Improvements**:
- Automatic database initialization after container starts
- Better error handling
- Clearer status messages

### 4. ✅ Enhanced npm Scripts
**Updated**: `package.json`

**New Scripts**:
- `docker:init` - Initialize SUSDB database
- `docker:start:init` - Start container and initialize database

**Updated Scripts**:
- `docker:test` - Now uses `docker:start:init` for complete setup

### 5. ✅ Created Quick Fix Guide
**New File**: `docker/QUICK_FIX_GUIDE.md`

Comprehensive guide with:
- Quick start instructions
- Troubleshooting steps
- Command reference
- Verification checklist

## How It Works Now

### Complete Setup Flow

1. **Start Container**:
   ```powershell
   npm run docker:start
   ```

2. **Initialize Database** (automatic with `docker:start:init`):
   ```powershell
   npm run docker:init
   ```

3. **Test Connection**:
   ```powershell
   npm run test:docker
   ```

### Or Use Automated Setup

```powershell
npm run docker:setup
```

This single command:
1. Checks Docker installation
2. Starts SQL Server container
3. Waits for SQL Server to be ready
4. Initializes SUSDB database
5. Tests connection
6. Shows summary

## Testing

### Quick Test
```powershell
npm run docker:test:app
```

This comprehensive test verifies:
- ✅ Container status
- ✅ Network connectivity
- ✅ SQL Server connection
- ✅ Database operations
- ✅ Application compatibility

### Manual Testing Steps

1. **Check Docker**:
   ```powershell
   docker ps
   ```

2. **Start Container**:
   ```powershell
   npm run docker:start:init
   ```

3. **Check Logs**:
   ```powershell
   npm run docker:logs
   ```

4. **Test Connection**:
   ```powershell
   npm run test:docker
   ```

5. **Full Integration Test**:
   ```powershell
   npm run docker:test:app
   ```

## Connection Information

Once setup is complete:

- **Server**: `localhost,1433`
- **Username**: `SA`
- **Password**: `WSUS_Admin123!`
- **Database**: `SUSDB`

## Troubleshooting

### Container won't start
```powershell
# Check Docker status
docker ps

# Check logs
npm run docker:logs

# Clean and restart
npm run docker:clean
npm run docker:start:init
```

### Database initialization fails
```powershell
# Ensure container is running
npm run docker:status

# Wait for SQL Server (check logs)
npm run docker:logs

# Run initialization manually
npm run docker:init
```

### Connection fails
1. Wait 30-60 seconds after container starts
2. Check container health: `npm run docker:status`
3. Check logs: `npm run docker:logs`
4. Test connection: `npm run test:docker`

## Files Changed

- ✅ `docker-compose.yml` - Removed incorrect volume mount
- ✅ `docker/scripts/init-sqlserver.ps1` - NEW: SQL initialization script
- ✅ `docker/scripts/setup-docker.ps1` - Updated to call init script
- ✅ `docker/scripts/start-lab.ps1` - Updated to call init script
- ✅ `docker/scripts/test-app-integration.ps1` - Updated to call init script
- ✅ `package.json` - Added new npm scripts
- ✅ `docker/QUICK_FIX_GUIDE.md` - NEW: Quick reference guide
- ✅ `docker/SETUP_FIXES.md` - NEW: This file

## Next Steps

1. **Install Docker Desktop** (if not installed):
   ```powershell
   npm run docker:install:check
   ```

2. **Run Setup**:
   ```powershell
   npm run docker:setup
   ```

3. **Test Everything**:
   ```powershell
   npm run docker:test:app
   ```

4. **Start Application**:
   ```powershell
   npm start
   ```

5. **Configure Connection** in the app:
   - Server: `localhost,1433`
   - Username: `SA`
   - Password: `WSUS_Admin123!`
   - Database: `SUSDB`

## Notes

- SQL Server containers take 30-60 seconds to fully start
- Database initialization runs automatically after container starts (when using `docker:start:init` or `docker:setup`)
- All scripts include proper error handling and retry logic
- Scripts are PowerShell-based for Windows compatibility

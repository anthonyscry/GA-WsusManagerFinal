# Application Testing Guide for Docker Environment

This guide explains how to test the GA-WsusManager Pro application against the Docker SQL Server container.

## 🎯 Overview

The Docker environment provides an isolated SQL Server 2022 instance for testing without affecting production systems.

## 🚀 Quick Start Testing

### 1. Start Docker SQL Server

```powershell
# Start the container
npm run docker:start

# Wait for SQL Server to be ready (30-60 seconds)
# Check status
npm run docker:status

# View logs to verify it's ready
npm run docker:logs
```

### 2. Run Integration Tests

```powershell
# Comprehensive application integration test
npm run docker:test:app

# Or just test SQL connection
npm run test:docker
```

### 3. Configure Application for Docker

The application needs to be configured to use the Docker SQL Server. You have two options:

#### Option A: Environment Variables (Recommended)

Create a `.env` file in the project root:

```env
SQL_SERVER_INSTANCE=localhost,1433
WSUS_DATABASE_NAME=SUSDB
DOCKER_ENV=true
NODE_ENV=development
```

#### Option B: Update sqlService.ts Default

The `sqlService.ts` already supports Docker format (`localhost,1433`) when `DOCKER_ENV=true` is set.

### 4. Start Application

```powershell
npm start
```

### 5. Test Application Features

#### Database Operations (Maintenance View)

1. Navigate to **Maintenance** view
2. Enter SQL SA credentials:
   - **Server**: `localhost,1433`
   - **Username**: `SA`
   - **Password**: `WSUS_Admin123!`
   - **Database**: `SUSDB`
3. Test operations:
   - **Database Reindex** - Verifies SQL connection and query execution
   - **Database Cleanup** - Tests SQL maintenance operations
   - **Get Database Metrics** - Tests SELECT queries

#### SQL Express Installation Test

1. Navigate to **Maintenance** → **Deployment**
2. Test **Install SQL Express 2022** operation
3. Verify it can detect and connect to the containerized SQL Server

## 🧪 Test Scenarios

### Scenario 1: Basic Connection Test

```powershell
# Start container
npm run docker:start

# Wait 30 seconds
Start-Sleep -Seconds 30

# Test connection
npm run test:docker

# Expected: ✅ Connection successful
```

### Scenario 2: Application Database Operations

1. Start SQL Server container: `npm run docker:start`
2. Wait for container to be healthy: `npm run docker:status`
3. Start application: `npm start`
4. Navigate to Maintenance view
5. Enter Docker SQL credentials
6. Execute "Database Reindex"
7. **Expected**: Operation completes successfully

### Scenario 3: Full Integration Test

```powershell
# Run comprehensive test suite
npm run docker:test:app

# This tests:
# - Container status
# - Network connectivity
# - SQL connection
# - Database operations
# - Application compatibility
```

### Scenario 4: Application with Mock Data

If SUSDB doesn't exist yet (WSUS not configured), the application will:
- Use mock data for WSUS computers and updates
- Still allow SQL operations if credentials are provided
- Show connection status in the UI

## 📊 Connection Details

**Docker SQL Server:**
- **Server**: `localhost,1433`
- **Username**: `SA`
- **Password**: `WSUS_Admin123!` (default from docker-compose.yml)
- **Database**: `SUSDB` (created automatically on first WSUS connection)

**Application Configuration:**
- The app uses `sqlService` which supports both formats:
  - Docker: `localhost,1433`
  - Local SQL Express: `localhost\SQLEXPRESS`

## 🔧 Troubleshooting

### Application Can't Connect to SQL Server

1. **Verify container is running:**
   ```powershell
   docker-compose ps
   # Should show wsus-sqlserver as "Up (healthy)"
   ```

2. **Check container logs:**
   ```powershell
   npm run docker:logs
   # Look for "SQL Server is now ready for client connections"
   ```

3. **Test connection manually:**
   ```powershell
   npm run test:docker
   ```

4. **Verify credentials:**
   - Server: `localhost,1433` (not `localhost\SQLEXPRESS`)
   - Username: `SA` (case-sensitive)
   - Password: `WSUS_Admin123!` (must match docker-compose.yml)

5. **Check firewall:**
   - Port 1433 should be accessible
   - Docker Desktop should have network access

### Application Shows "Connection Failed"

1. **Wait longer:** SQL Server can take 30-60 seconds to fully start
2. **Check SQL Server authentication:**
   ```powershell
   # Should return 0 (SQL Auth enabled)
   docker exec wsus-sqlserver /opt/mssql-tools/bin/sqlcmd -S localhost -U SA -P "WSUS_Admin123!" -Q "SELECT SERVERPROPERTY('IsIntegratedSecurityOnly')"
   ```

3. **Verify SA account is enabled:**
   ```powershell
   docker exec wsus-sqlserver /opt/mssql-tools/bin/sqlcmd -S localhost -U SA -P "WSUS_Admin123!" -Q "SELECT is_disabled FROM sys.sql_logins WHERE name = 'sa'"
   # Should return 0 (enabled)
   ```

### Database Operations Fail

1. **Check if SUSDB exists:**
   ```powershell
   docker exec wsus-sqlserver /opt/mssql-tools/bin/sqlcmd -S localhost -U SA -P "WSUS_Admin123!" -Q "SELECT name FROM sys.databases WHERE name = 'SUSDB'"
   ```

2. **If SUSDB doesn't exist:**
   - This is normal if WSUS hasn't connected yet
   - The app will use mock data
   - SQL operations will work once SUSDB is created

3. **Check application logs:**
   - Open DevTools in Electron (Ctrl+Shift+I)
   - Check Console for SQL errors

## ✅ Test Checklist

Before considering testing complete:

- [ ] Docker container is running and healthy
- [ ] SQL connection test passes (`npm run test:docker`)
- [ ] Application can start without errors
- [ ] Application can connect to SQL Server (Maintenance view)
- [ ] Database Reindex operation completes successfully
- [ ] Database Metrics can be retrieved
- [ ] Application logs show successful SQL operations
- [ ] No connection errors in application console

## 📝 Notes

- **SUSDB Creation**: The SUSDB database is created automatically when WSUS server connects. For app testing, you can create it manually or the app will use mock data.
- **Port Conflicts**: If port 1433 is already in use, edit `docker-compose.yml` to use a different port (e.g., `14330:1433`)
- **Data Persistence**: Container data persists in Docker volumes. Use `npm run docker:clean` to reset everything.
- **Performance**: Docker SQL Server may be slower than native installation, especially on first startup.

## 🎉 Success Criteria

Testing is successful when:
1. ✅ All integration tests pass
2. ✅ Application can connect to Docker SQL Server
3. ✅ Database operations complete without errors
4. ✅ Application logs show successful SQL queries
5. ✅ No connection timeouts or authentication errors

---

**Next Steps**: Once Docker testing is complete, test against a real WSUS environment or proceed with production deployment.

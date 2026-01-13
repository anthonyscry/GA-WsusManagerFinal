# Docker Container Testing Guide

This guide explains how to use Docker containers to test the GA-WsusManager Pro application functionality.

## 🎯 Overview

The Docker setup provides:
- **SQL Server 2022 Container** - For testing database operations
- **Isolated Test Environment** - No impact on production systems
- **Easy Reset** - Clean slate for each test session

## 🚀 Quick Start Testing

### 1. Start SQL Server Container

```powershell
# Using the provided script
.\docker\scripts\start-lab.ps1

# Or manually
docker-compose up -d sqlserver
```

### 2. Verify Container is Running

```powershell
# Check container status
docker-compose ps

# View logs
docker-compose logs -f sqlserver

# Test connection
.\docker\scripts\test-connection.ps1
```

### 3. Configure Application for Testing

The application will automatically connect to:
- **Server**: `localhost,1433`
- **Username**: `SA`
- **Password**: `WSUS_Admin123!` (default from docker-compose.yml)
- **Database**: `SUSDB` (created when WSUS is configured)

### 4. Test Application Features

#### Database Operations
1. Start the application: `npm start`
2. Navigate to **Maintenance** view
3. Test operations:
   - **Database Reindex** - Tests SQL connection and query execution
   - **Database Cleanup** - Tests SQL maintenance operations
   - **Export/Import** - Tests database export functionality

#### SQL Express Installation
1. Navigate to **Maintenance** → **Deployment**
2. Test **Install SQL Express 2022** operation
3. Verify it can connect to the containerized SQL Server

## 🧪 Testing Scenarios

### Scenario 1: Basic SQL Connection
```powershell
# Start container
docker-compose up -d sqlserver

# Run connection test
.\docker\scripts\test-connection.ps1

# Expected: ✅ Connection successful
```

### Scenario 2: Application Database Operations
1. Start SQL Server container
2. Start application: `npm start`
3. Navigate to Maintenance view
4. Execute "Database Reindex"
5. **Expected**: Operation completes successfully, logs show SQL queries executed

### Scenario 3: Air-Gap Mode Testing
1. Stop SQL Server container: `docker-compose stop sqlserver`
2. Start application
3. **Expected**: Application automatically switches to Air-Gap mode
4. Database operations should show appropriate offline messages

### Scenario 4: Cloud-Sync Mode Testing
1. Start SQL Server container
2. Ensure internet connectivity
3. Start application
4. **Expected**: Application automatically switches to Cloud-Sync mode
5. Database operations should connect successfully

## 🔧 Advanced Testing

### Test with Custom Configuration

Edit `docker-compose.yml` to customize:
```yaml
environment:
  - MSSQL_SA_PASSWORD=YourCustomPassword
  - MSSQL_PID=Express  # Use Express instead of Developer
```

Then restart:
```powershell
docker-compose down
docker-compose up -d sqlserver
```

### Test Database Persistence

Data persists in Docker volumes:
```powershell
# View volume
docker volume inspect wsus_sqlserver_data

# Backup volume
docker run --rm -v wsus_sqlserver_data:/data -v ${PWD}:/backup alpine tar czf /backup/susdb-backup.tar.gz /data

# Restore volume
docker-compose down
docker run --rm -v wsus_sqlserver_data:/data -v ${PWD}:/backup alpine tar xzf /backup/susdb-backup.tar.gz -C /
docker-compose up -d sqlserver
```

### Test Network Isolation

Containers use isolated network `wsus-network`:
```powershell
# Inspect network
docker network inspect wsus-network

# Connect to container
docker exec -it wsus-sqlserver /bin/bash

# Test from inside container
/opt/mssql-tools/bin/sqlcmd -S localhost -U SA -P "WSUS_Admin123!" -Q "SELECT @@VERSION"
```

## 🐛 Troubleshooting

### Container Won't Start
```powershell
# Check Docker is running
docker ps

# Check logs
docker-compose logs sqlserver

# Check port availability
netstat -an | findstr :1433
```

### Connection Refused
1. Verify container is running: `docker-compose ps`
2. Check container logs: `docker-compose logs sqlserver`
3. Verify port mapping: `docker port wsus-sqlserver`
4. Test from container: `docker exec wsus-sqlserver /opt/mssql-tools/bin/sqlcmd -S localhost -U SA -P "WSUS_Admin123!" -Q "SELECT 1"`

### Application Can't Connect
1. Verify SQL Server is accessible: `.\docker\scripts\test-connection.ps1`
2. Check firewall settings
3. Verify credentials match docker-compose.yml
4. Check application logs for connection errors

## 📊 Test Results

After running tests, verify:
- ✅ SQL Server container starts successfully
- ✅ Application can connect to SQL Server
- ✅ Database operations execute without errors
- ✅ Air-Gap mode activates when container is stopped
- ✅ Cloud-Sync mode activates when container is running and online
- ✅ Automatic mode switching works correctly

## 🔄 Cleanup

```powershell
# Stop containers (keeps data)
docker-compose stop

# Stop and remove containers (keeps volumes)
docker-compose down

# Remove everything including volumes
docker-compose down -v
```

## 📝 Notes

- The Electron application runs on the **host**, not in Docker
- Only SQL Server runs in a container
- WSUS server requires Windows Server (not containerized in this setup)
- Container data persists between restarts via Docker volumes
- Default password is for testing only - change for production

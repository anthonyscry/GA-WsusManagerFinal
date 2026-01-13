# WSUS Manager Lab Environment - Docker Setup

This directory contains Docker configuration files to set up a complete lab environment for testing the GA-WsusManager Pro application.

## 🏗️ Architecture Overview

The lab environment consists of:
1. **SQL Server Container** - Provides the SUSDB database for WSUS
2. **WSUS Server** - Windows Server with WSUS installed (see setup instructions below)
3. **Application** - The GA-WsusManager Pro Electron app (runs on host)

## 📋 Prerequisites

### For SQL Server Container (Works on Windows, Linux, macOS):
- Docker Desktop or Docker Engine
- Docker Compose v2.0+

### For WSUS Server (Windows-only):
- Windows 10/11 Pro/Enterprise or Windows Server
- Windows Containers enabled (optional, see Alternative Setup)
- Minimum 8GB RAM
- 50GB+ free disk space

## 🚀 Quick Start

### 1. Start SQL Server Container

**Quick Start (PowerShell):**
```powershell
# Run the quick start script
.\docker\scripts\start-lab.ps1

# Or use Docker Compose directly
docker-compose up -d sqlserver

# Verify SQL Server is running
docker-compose ps

# Check logs
docker-compose logs -f sqlserver
```

**Quick Start (Bash/Linux):**
```bash
# Start SQL Server container
docker-compose up -d sqlserver

# Verify SQL Server is running
docker-compose ps

# Check logs
docker-compose logs -f sqlserver
```

### 2. Connect to SQL Server

The SQL Server container will be available at:
- **Server**: `localhost,1433` or `wsus-sqlserver` (from within Docker network)
- **Username**: `SA`
- **Password**: `WSUS_Admin123!` (default, change in docker-compose.yml for production)
- **Database**: `SUSDB` (created automatically)

You can connect using:
- SQL Server Management Studio (SSMS)
- Azure Data Studio
- `sqlcmd` command line tool
- PowerShell `Invoke-Sqlcmd`

Example connection string:
```
Server=localhost,1433;Database=SUSDB;User Id=SA;Password=WSUS_Admin123!;TrustServerCertificate=True;
```

### 3. Set Up WSUS Server

WSUS requires Windows Server and cannot run in Linux containers. You have two options:

#### Option A: Windows Container (Advanced)

If you have Windows Containers enabled:

```bash
# Build WSUS Windows container (requires Windows host)
docker build -f docker/Dockerfile.wsus -t wsus-server:latest .

# Run WSUS container (see docker-compose.yml for full setup)
docker-compose up -d wsus-server
```

**Note**: Full WSUS installation in containers is complex and typically requires a custom Windows Server image with WSUS pre-installed.

#### Option B: Local Windows Server / VM (Recommended)

For a true lab environment, set up WSUS on:
1. **Windows Server VM** (Hyper-V, VMware, VirtualBox)
2. **Windows 10/11 Pro/Enterprise** (with WSUS feature installed)
3. **Dedicated Windows Server** (physical or cloud)

**WSUS Installation Steps**:

1. Install WSUS Server role:
   ```powershell
   Install-WindowsFeature -Name UpdateServices -IncludeManagementTools
   ```

2. Configure WSUS to use SQL Server container:
   - During WSUS configuration wizard, specify SQL Server instance: `localhost,1433` or your Docker host IP
   - Use SQL Server authentication: `SA` / `WSUS_Admin123!`
   - Database name: `SUSDB`

3. Complete WSUS post-installation:
   ```powershell
   # Open WSUS console and complete configuration
   # Or use wsusutil.exe:
   wsusutil.exe postinstall CONTENT_PATH=C:\WSUS\Content SQL_INSTANCE_NAME="localhost,1433"
   ```

### 4. Configure Application

Update your application configuration to connect to the lab environment:

**Environment Variables** (or update in application):
```bash
SQL_SERVER_INSTANCE=localhost,1433
WSUS_DATABASE_NAME=SUSDB
WSUS_SERVER=localhost
WSUS_PORT=8530
WSUS_USE_SSL=false
```

Or update `services/sqlService.ts` and `services/wsusService.ts` with connection details.

### 5. Install WSUS PowerShell Module

On the machine running the application:

```powershell
# Install WSUS PowerShell module
Install-Module -Name UpdateServices -Force -Scope CurrentUser -AllowClobber

# Verify installation
Get-Module -ListAvailable -Name UpdateServices
```

## 🔧 Configuration

### SQL Server Configuration

Edit `docker-compose.yml` to customize SQL Server settings:

```yaml
environment:
  - MSSQL_SA_PASSWORD=YourSecurePassword
  - MSSQL_PID=Developer  # Options: Developer, Express, Standard, Enterprise
```

### Network Configuration

The containers use a bridge network named `wsus-network`. Containers can communicate using service names:
- SQL Server: `wsus-sqlserver` or `sqlserver`
- WSUS Server: `wsus-server` (if using Windows containers)

### Volume Persistence

Data is persisted in Docker volumes:
- `wsus_sqlserver_data` - SQL Server database files
- Volumes are created automatically by docker-compose

To backup/restore:
```bash
# Backup
docker run --rm -v wsus_sqlserver_data:/data -v $(pwd):/backup alpine tar czf /backup/susdb-backup.tar.gz /data

# Restore (stop container first)
docker-compose down
docker run --rm -v wsus_sqlserver_data:/data -v $(pwd):/backup alpine tar xzf /backup/susdb-backup.tar.gz -C /
docker-compose up -d
```

## 🧪 Testing the Setup

### 1. Verify SQL Server

```bash
# Connect using sqlcmd (install SQL Server tools if needed)
docker exec -it wsus-sqlserver /opt/mssql-tools/bin/sqlcmd \
  -S localhost -U SA -P "WSUS_Admin123!" \
  -Q "SELECT name FROM sys.databases WHERE name = 'SUSDB'"
```

Or using PowerShell:
```powershell
Invoke-Sqlcmd -ServerInstance "localhost,1433" -Database "SUSDB" `
  -Username "SA" -Password "WSUS_Admin123!" `
  -Query "SELECT @@VERSION"
```

### 2. Verify WSUS Connection

```powershell
# Test WSUS PowerShell connection
Import-Module UpdateServices
$wsus = Get-WsusServer -Name localhost -PortNumber 8530
$wsus.GetStatus()
```

### 3. Test Application Connection

1. Start the GA-WsusManager Pro application
2. Check application logs for connection status
3. Verify dashboard shows real WSUS data (not mock data)

## 🔍 Troubleshooting

### SQL Server Container Won't Start

```bash
# Check logs
docker-compose logs sqlserver

# Common issues:
# - Port 1433 already in use: Change port in docker-compose.yml
# - Insufficient memory: Increase Docker memory allocation
# - Volume permissions: Ensure Docker has proper permissions
```

### Cannot Connect to SQL Server

1. **Check container is running**:
   ```bash
   docker-compose ps
   ```

2. **Verify network connectivity**:
   ```bash
   # From host
   telnet localhost 1433
   # Or
   Test-NetConnection -ComputerName localhost -Port 1433
   ```

3. **Check SQL Server logs**:
   ```bash
   docker-compose logs sqlserver | tail -50
   ```

4. **Verify credentials**: Default is `SA` / `WSUS_Admin123!`

### WSUS Cannot Connect to SQL Server

1. **Check SQL Server is accessible from WSUS host**:
   - Use Docker host IP (not `localhost` from WSUS machine)
   - For Windows containers, use `sqlserver` hostname
   - For external WSUS, use Docker host IP address

2. **Verify SQL Server authentication is enabled**:
   - SQL Server container has mixed-mode authentication by default
   - Ensure credentials are correct

3. **Check firewall rules**:
   - Port 1433 must be open between WSUS and SQL Server

### Application Shows Mock Data

If the application shows mock data instead of real WSUS data:

1. **Check WSUS service is running**:
   ```powershell
   Get-Service -Name WsusService
   ```

2. **Verify WSUS PowerShell module is installed**:
   ```powershell
   Get-Module -ListAvailable -Name UpdateServices
   ```

3. **Test WSUS connection manually**:
   ```powershell
   Import-Module UpdateServices
   $wsus = Get-WsusServer -Name localhost -PortNumber 8530
   $wsus.GetComputers()
   ```

4. **Check application logs** for connection errors

## 📚 Additional Resources

- [SQL Server on Docker Documentation](https://docs.microsoft.com/en-us/sql/linux/sql-server-linux-docker-container-configure)
- [WSUS Documentation](https://docs.microsoft.com/en-us/windows-server/administration/windows-server-update-services/get-started/windows-server-update-services-wsus)
- [WSUS PowerShell Module](https://docs.microsoft.com/en-us/powershell/module/updateservices/)

## 🛑 Stopping the Environment

```bash
# Stop all containers
docker-compose down

# Stop and remove volumes (⚠️ deletes all data)
docker-compose down -v

# Stop but keep containers
docker-compose stop
```

## 🔐 Security Notes

**⚠️ Important for Production:**

1. **Change default passwords** in `docker-compose.yml`
2. **Use environment variables** for sensitive data (see `.env.example`)
3. **Restrict network access** - don't expose SQL Server port publicly
4. **Use SSL/TLS** for WSUS connections in production
5. **Create dedicated service accounts** instead of using SA
6. **Regular backups** of SUSDB database
7. **Keep containers updated** with security patches

## 📝 Notes

- SQL Server Developer Edition is used (free for development)
- SUSDB database is automatically initialized on first run
- Full WSUS schema is created when WSUS server connects to SUSDB
- Windows Containers require Windows Pro/Enterprise or Server
- WSUS in containers is experimental - use Windows Server VM for production-like testing

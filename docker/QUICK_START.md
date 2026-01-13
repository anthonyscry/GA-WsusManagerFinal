# WSUS Lab Environment - Quick Start Guide

This is a quick reference guide. For detailed information, see [README.md](./README.md).

## 🚀 5-Minute Setup

### 1. Start SQL Server

```powershell
# Option A: Use the helper script (recommended)
.\docker\scripts\start-lab.ps1

# Option B: Use Docker Compose directly
docker-compose up -d sqlserver
```

### 2. Verify SQL Server is Running

```powershell
docker-compose ps
# Should show sqlserver container as "Up (healthy)"
```

### 3. Connect to SQL Server

- **Server**: `localhost,1433`
- **Username**: `SA`
- **Password**: `WSUS_Admin123!`
- **Database**: `SUSDB`

Test connection:
```powershell
Invoke-Sqlcmd -ServerInstance "localhost,1433" -Database "SUSDB" `
  -Username "SA" -Password "WSUS_Admin123!" `
  -Query "SELECT @@VERSION"
```

### 4. Set Up WSUS Server

WSUS requires Windows Server. Options:

**Option A: Windows Server VM** (Recommended)
1. Install Windows Server (Hyper-V, VMware, VirtualBox)
2. Install WSUS role: `Install-WindowsFeature -Name UpdateServices`
3. Configure WSUS to use SQL Server: `localhost,1433`
4. Complete WSUS configuration wizard

**Option B: Local Windows Machine**
1. Install WSUS feature (Windows 10/11 Pro/Enterprise or Server)
2. Run setup script: `.\docker\scripts\setup-wsus-local.ps1`
3. Follow on-screen instructions

### 5. Install WSUS PowerShell Module

```powershell
Install-Module -Name UpdateServices -Force -Scope CurrentUser
```

### 6. Test WSUS Connection

```powershell
Import-Module UpdateServices
$wsus = Get-WsusServer -Name localhost -PortNumber 8530
$wsus.GetStatus()
```

### 7. Run Application

```powershell
npm start
# Or
npm run electron:dev
```

The application should detect WSUS and show real data instead of mock data.

## 🛑 Common Commands

```powershell
# Start lab environment
.\docker\scripts\start-lab.ps1

# Stop containers
.\docker\scripts\start-lab.ps1 -Stop

# View logs
.\docker\scripts\start-lab.ps1 -Logs

# Restart containers
.\docker\scripts\start-lab.ps1 -Restart

# Clean everything (removes all data)
.\docker\scripts\start-lab.ps1 -Clean
```

## ❓ Troubleshooting

**SQL Server won't start?**
- Check Docker is running
- Check port 1433 is not in use
- View logs: `docker-compose logs sqlserver`

**Can't connect to SQL Server?**
- Verify container is running: `docker-compose ps`
- Test connection: `Test-NetConnection -ComputerName localhost -Port 1433`
- Check credentials match docker-compose.yml

**Application shows mock data?**
- Verify WSUS service is running: `Get-Service WsusService`
- Check WSUS PowerShell module: `Get-Module -ListAvailable UpdateServices`
- Test WSUS connection manually (see step 6 above)

## 📚 More Information

- Full documentation: [README.md](./README.md)
- Application README: [../README.md](../README.md)

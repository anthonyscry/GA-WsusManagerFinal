# GA-WsusManager Pro SOP (Standard Operating Procedures)

## 1. Purpose
Provide a standardized, repeatable process to set up, operate, and maintain the GA-WsusManager Pro application and its lab environment, including WSUS and SQL Server integration for GA-ASI lab use.

## 2. Scope
This SOP covers:
- Local development setup
- Lab environment setup with Docker + WSUS
- Configuration and runtime operations
- Security practices for credentials and data handling
- Troubleshooting and validation
- Build and release packaging steps

## 3. Roles & Responsibilities
| Role | Responsibilities |
| --- | --- |
| Application Operator | Run the app, validate connectivity, perform routine checks. |
| Lab Environment Admin | Manage Docker SQL Server, WSUS server setup, backups, and connectivity. |
| Release Manager | Build portable EXE, ensure release artifacts are generated. |

## 4. References
- Project README (Quick Start + build instructions).【F:README.md†L1-L27】
- Docker lab environment setup (SQL Server container, WSUS configuration, backup/restore, troubleshooting).【F:docker/README.md†L1-L233】

## 5. Prerequisites
### 5.1 Application
- Node.js v20+ installed.
- Dependencies installed via `npm install`.

Quick Start commands:
```bash
npm install
npm start
```
【F:README.md†L7-L18】

### 5.2 Lab Environment
- Docker Desktop or Docker Engine + Docker Compose v2.0+.
- (Optional) Windows Server/Windows 10/11 Pro/Enterprise for WSUS host.
- Minimum 8GB RAM and 50GB+ disk space for WSUS host.
【F:docker/README.md†L11-L24】

## 6. Environment Setup (Lab)
### 6.1 Start SQL Server Container
PowerShell:
```powershell
# Quick start script
.\docker\scripts\start-lab.ps1

# Or use Docker Compose directly
docker-compose up -d sqlserver
```
Bash:
```bash
docker-compose up -d sqlserver
```
【F:docker/README.md†L26-L55】

### 6.2 SQL Server Connection Details
- Server: `localhost,1433` (host) or `wsus-sqlserver` (Docker network)
- Username: `SA`
- Password: `WSUS_Admin123!` (default; change for production)
- Database: `SUSDB`

Example connection string:
```
Server=localhost,1433;Database=SUSDB;User Id=SA;Password=WSUS_Admin123!;TrustServerCertificate=True;
```
【F:docker/README.md†L56-L76】

### 6.3 WSUS Server Setup
WSUS cannot run in Linux containers; use Windows Server or Windows 10/11 Pro/Enterprise.

Recommended steps:
1. Install WSUS Server role:
   ```powershell
   Install-WindowsFeature -Name UpdateServices -IncludeManagementTools
   ```
2. Configure WSUS to use SQL Server instance `localhost,1433` (or Docker host IP).
3. Run WSUS post-installation:
   ```powershell
   wsusutil.exe postinstall CONTENT_PATH=C:\WSUS\Content SQL_INSTANCE_NAME="localhost,1433"
   ```
【F:docker/README.md†L77-L128】

### 6.4 Application Configuration
Set environment variables (or update application config):
```bash
SQL_SERVER_INSTANCE=localhost,1433
WSUS_DATABASE_NAME=SUSDB
WSUS_SERVER=localhost
WSUS_PORT=8530
WSUS_USE_SSL=false
```
【F:docker/README.md†L129-L146】

### 6.5 Install WSUS PowerShell Module
```powershell
Install-Module -Name UpdateServices -Force -Scope CurrentUser -AllowClobber
Get-Module -ListAvailable -Name UpdateServices
```
【F:docker/README.md†L148-L158】

## 7. Validation & Health Checks
### 7.1 SQL Server Validation
```bash
docker exec -it wsus-sqlserver /opt/mssql-tools/bin/sqlcmd \
  -S localhost -U SA -P "WSUS_Admin123!" \
  -Q "SELECT name FROM sys.databases WHERE name = 'SUSDB'"
```
【F:docker/README.md†L184-L194】

### 7.2 WSUS Validation
```powershell
Import-Module UpdateServices
$wsus = Get-WsusServer -Name localhost -PortNumber 8530
$wsus.GetStatus()
```
【F:docker/README.md†L200-L207】

### 7.3 Application Validation
1. Start the application.
2. Check logs for connection status.
3. Confirm dashboards show real WSUS data (not mock data).
【F:docker/README.md†L209-L214】

## 8. Operations
### 8.1 Start/Stop Environment
```bash
# Stop all containers
docker-compose down

# Stop and remove volumes (⚠️ deletes data)
docker-compose down -v

# Stop but keep containers
docker-compose stop
```
【F:docker/README.md†L229-L239】

### 8.2 Backup/Restore SQL Server Data
Backup:
```bash
docker run --rm -v wsus_sqlserver_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/susdb-backup.tar.gz /data
```
Restore:
```bash
docker-compose down

docker run --rm -v wsus_sqlserver_data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/susdb-backup.tar.gz -C /

docker-compose up -d
```
【F:docker/README.md†L166-L182】

## 9. Build & Release
### 9.1 Local Build
```bash
npm run build:exe
```
The portable EXE is created in the `dist/` folder.
【F:README.md†L20-L27】

### 9.2 CI Build (GitHub Actions)
- Push to `main` and download the artifact from the **Actions** tab.
【F:README.md†L20-L23】

## 10. Security & Credentials
- Database operations require SQL SA credentials stored in a non-persistent session vault (browser localStorage) and not sent externally.
【F:README.md†L37-L38】
- Change default passwords in `docker-compose.yml` for production.
- Use environment variables for sensitive values.
- Restrict SQL Server network exposure and use SSL/TLS in production.
【F:docker/README.md†L242-L251】

## 11. Troubleshooting
### 11.1 SQL Server Container Won’t Start
- Check logs:
  ```bash
  docker-compose logs sqlserver
  ```
- Common issues: port conflicts, insufficient memory, volume permissions.
【F:docker/README.md†L215-L224】

### 11.2 Cannot Connect to SQL Server
1. Verify container is running:
   ```bash
   docker-compose ps
   ```
2. Verify network connectivity:
   ```bash
   telnet localhost 1433
   # or
   Test-NetConnection -ComputerName localhost -Port 1433
   ```
3. Inspect logs:
   ```bash
   docker-compose logs sqlserver | tail -50
   ```
4. Verify credentials (default: `SA` / `WSUS_Admin123!`).
【F:docker/README.md†L226-L252】

### 11.3 WSUS Cannot Connect to SQL Server
- Ensure WSUS uses the Docker host IP (not `localhost`) if WSUS is on another machine.
- Ensure SQL Server authentication is enabled and port 1433 is open.
【F:docker/README.md†L254-L269】

### 11.4 Application Shows Mock Data
1. Verify WSUS service is running:
   ```powershell
   Get-Service -Name WsusService
   ```
2. Verify WSUS PowerShell module is installed:
   ```powershell
   Get-Module -ListAvailable -Name UpdateServices
   ```
3. Test WSUS connection:
   ```powershell
   Import-Module UpdateServices
   $wsus = Get-WsusServer -Name localhost -PortNumber 8530
   $wsus.GetComputers()
   ```
4. Check application logs for connection errors.
【F:docker/README.md†L271-L292】

## 12. Change Management
- Record configuration changes to SQL Server or WSUS instances.
- Validate with Section 7 checks after changes.
- Use backup before making schema or environment changes.

## 13. Incident Response (Lab)
1. Capture logs (Docker logs, application logs).
2. Re-validate database and WSUS connectivity (Section 7).
3. If data corruption suspected, restore from last known backup (Section 8.2).
4. Document timeline and resolution for post-incident review.

## 14. Appendix: Common Commands
```bash
npm install
npm start
npm run build:exe

docker-compose up -d sqlserver
docker-compose logs -f sqlserver
docker-compose ps
docker-compose down
```
【F:README.md†L7-L27】【F:docker/README.md†L26-L55】【F:docker/README.md†L229-L239】

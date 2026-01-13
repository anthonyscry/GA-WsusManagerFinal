# Docker Setup Quick Fix Guide

This guide helps you quickly set up and test Docker for the WSUS Manager application.

## 🚀 Quick Start (3 Steps)

### Step 1: Check Docker Installation

```powershell
npm run docker:install:check
```

If Docker is not installed, follow the instructions provided, or:
- Download from: https://www.docker.com/products/docker-desktop
- Install and start Docker Desktop
- Wait for Docker Desktop to fully start (check system tray icon)

### Step 2: Setup Docker Environment

```powershell
npm run docker:setup
```

This will:
- ✅ Check Docker installation
- ✅ Start SQL Server container
- ✅ Initialize SUSDB database
- ✅ Test connection

### Step 3: Test Application Integration

```powershell
npm run docker:test:app
```

This comprehensive test verifies:
- ✅ Container is running
- ✅ Network connectivity
- ✅ SQL Server connection
- ✅ Database operations
- ✅ Application compatibility

## 🔧 Troubleshooting

### Issue: Docker command not found

**Solution:**
1. Install Docker Desktop from https://www.docker.com/products/docker-desktop
2. Start Docker Desktop
3. Wait for it to fully start (system tray icon should be steady)
4. Restart your terminal/PowerShell

### Issue: Container won't start

**Solution:**
```powershell
# Check Docker status
docker ps

# Check logs
npm run docker:logs

# Clean and restart
npm run docker:clean
npm run docker:start:init
```

### Issue: SQL Server connection fails

**Solution:**
1. Wait 30-60 seconds after container starts (SQL Server needs time to initialize)
2. Run initialization manually:
   ```powershell
   npm run docker:init
   ```
3. Test connection:
   ```powershell
   npm run test:docker
   ```

### Issue: Database initialization fails

**Solution:**
1. Ensure container is running: `npm run docker:status`
2. Wait for SQL Server to be ready (check logs: `npm run docker:logs`)
3. Run initialization manually:
   ```powershell
   npm run docker:init
   ```

## 📋 Available Commands

| Command | Description |
|---------|-------------|
| `npm run docker:setup` | Full automated setup |
| `npm run docker:start` | Start SQL Server container |
| `npm run docker:start:init` | Start container and initialize database |
| `npm run docker:init` | Initialize SUSDB database (run after container starts) |
| `npm run docker:stop` | Stop containers |
| `npm run docker:restart` | Restart container |
| `npm run docker:status` | Show container status |
| `npm run docker:logs` | View container logs |
| `npm run docker:test:app` | Comprehensive integration test |
| `npm run test:docker` | Test SQL connection only |
| `npm run docker:clean` | Remove containers and volumes (⚠️ deletes data) |
| `npm run docker:validate` | Validate Docker configuration |

## 🔍 Verification Checklist

After setup, verify everything works:

- [ ] Docker Desktop is running
- [ ] Container is running: `npm run docker:status`
- [ ] SQL Server is accessible: `npm run test:docker`
- [ ] Database is initialized: `npm run docker:test:app`
- [ ] Application can connect (start app and test connection)

## 📞 Connection Information

Once setup is complete, use these credentials in your application:

- **Server**: `localhost,1433`
- **Username**: `SA`
- **Password**: `WSUS_Admin123!`
- **Database**: `SUSDB`

## 🎯 Next Steps

1. **Start the application**: `npm start`
2. **Navigate to Maintenance view**
3. **Configure SQL connection** with the credentials above
4. **Test database operations** (reindex, cleanup, etc.)

## 💡 Tips

- Always wait 30-60 seconds after starting the container before testing
- Use `npm run docker:logs` to monitor container startup
- Use `npm run docker:status` to check container health
- If something goes wrong, use `npm run docker:clean` to start fresh

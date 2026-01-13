# Docker Compose IDE Extension Guide

This guide explains how to use the Docker Compose IDE extension with the WSUS Manager Docker setup.

## 🎯 What the Extension Provides

The Docker Compose extension gives you:
- **Visual service management** - Start/stop containers from the IDE
- **Service status indicators** - See which containers are running
- **Log viewing** - View container logs directly in the IDE
- **File validation** - Validate docker-compose.yml syntax
- **Quick actions** - Right-click actions for common Docker operations

## 🚀 Using the Extension with Our Setup

### 1. Opening the Docker Compose File

1. Open `docker-compose.yml` in your IDE
2. The extension should automatically detect it
3. You'll see service indicators in the editor

### 2. Starting Services

**Option A: Using the Extension UI**
- Look for service indicators in the `docker-compose.yml` file
- Click the play button next to the `sqlserver` service
- Or use the extension's command palette

**Option B: Using npm Scripts (Recommended)**
```powershell
npm run docker:start
```

### 3. Viewing Service Status

The extension will show:
- ✅ Green indicator = Service is running
- ⏸️ Yellow indicator = Service is stopped
- ❌ Red indicator = Service has errors

### 4. Viewing Logs

**Using the Extension:**
- Right-click on the service in `docker-compose.yml`
- Select "View Logs" or "Show Logs"

**Using npm Scripts:**
```powershell
npm run docker:logs
```

### 5. Stopping Services

**Using the Extension:**
- Click the stop button next to the service
- Or right-click and select "Stop"

**Using npm Scripts:**
```powershell
npm run docker:stop
```

## 📋 Extension Features for Our Project

### Service: `sqlserver`

**Configuration:**
- Image: `mcr.microsoft.com/mssql/server:2022-latest`
- Port: `1433:1433`
- Environment: SA password configured
- Volumes: Data persistence and SQL init scripts

**Common Actions:**
- **Start**: `npm run docker:start` or use extension UI
- **Stop**: `npm run docker:stop` or use extension UI
- **Restart**: `npm run docker:restart`
- **View Logs**: `npm run docker:logs` or extension UI
- **Check Status**: `npm run docker:status`

## 🔧 Integration with Our Scripts

The extension works alongside our PowerShell scripts:

| Task | Extension | npm Script | When to Use |
|------|-----------|------------|-------------|
| Start container | ✅ UI button | `npm run docker:start` | Either works |
| View logs | ✅ Right-click | `npm run docker:logs` | Extension for quick view |
| Stop container | ✅ UI button | `npm run docker:stop` | Either works |
| Full setup | ❌ Not available | `npm run docker:setup` | Use npm script |
| Run tests | ❌ Not available | `npm run docker:test:app` | Use npm script |
| Validate setup | ❌ Not available | `npm run docker:validate` | Use npm script |

## 💡 Best Practices

1. **Use Extension For:**
   - Quick visual status checks
   - Viewing logs while developing
   - Starting/stopping containers during development

2. **Use npm Scripts For:**
   - Automated setup and testing
   - CI/CD pipelines
   - Comprehensive validation
   - Full integration tests

3. **Workflow:**
   ```
   1. Initial Setup: npm run docker:setup
   2. Daily Development: Use extension UI to start/stop
   3. Testing: npm run docker:test:app
   4. Troubleshooting: npm run docker:logs or extension logs
   ```

## 🐛 Troubleshooting

### Extension Not Showing Services

1. Ensure `docker-compose.yml` is in the project root
2. Reload the IDE window
3. Check that Docker Desktop is running

### Services Show as "Unknown"

1. Verify Docker Desktop is running
2. Run `docker ps` in terminal to confirm Docker is accessible
3. Try restarting the IDE

### Can't Start Services from Extension

1. Check Docker Desktop is running
2. Verify no port conflicts (port 1433)
3. Use `npm run docker:start` as alternative

## 📚 Additional Resources

- **Extension Documentation**: Check your IDE's extension marketplace
- **Docker Compose Docs**: https://docs.docker.com/compose/
- **Our Docker Setup**: See `docker/SETUP_COMPLETE.md`
- **Testing Guide**: See `docker/APP_TESTING_GUIDE.md`

## ✅ Quick Checklist

Before using the extension:
- [ ] Docker Desktop is installed
- [ ] Docker Desktop is running
- [ ] `docker-compose.yml` is in project root
- [ ] Extension is installed and enabled

Once ready:
- [ ] Open `docker-compose.yml` in IDE
- [ ] See service indicators
- [ ] Start `sqlserver` service
- [ ] Verify it's running (green indicator)
- [ ] Test connection: `npm run test:docker`

---

**Note**: The extension is a convenience tool. All functionality is also available via npm scripts and direct Docker commands.

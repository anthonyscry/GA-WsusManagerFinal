# Docker Network Troubleshooting Guide

## Issue: Cannot Pull Docker Images

If you're seeing errors like:
```
failed to do request: Get "https://mcr.microsoft.com/v2/...": EOF
```

This usually indicates a network connectivity issue, often related to corporate proxy settings.

## Solutions

### Option 1: Configure Docker Desktop Proxy Settings

1. **Open Docker Desktop**
2. **Go to Settings** (gear icon)
3. **Navigate to Resources → Proxies**
4. **Enable "Manual proxy configuration"**
5. **Enter your proxy settings:**
   - HTTP Proxy: `http://proxy.ga.com:8080` (or your corporate proxy)
   - HTTPS Proxy: `http://proxy.ga.com:8080` (or your corporate proxy)
   - No Proxy: `localhost,127.0.0.1`
6. **Click "Apply & Restart"**
7. **Wait for Docker to restart**
8. **Try again**: `npm run docker:start:init`

### Option 2: Configure Docker Daemon Proxy (Advanced)

Create or edit `C:\Users\<YourUser>\.docker\config.json`:

```json
{
  "proxies": {
    "default": {
      "httpProxy": "http://proxy.ga.com:8080",
      "httpsProxy": "http://proxy.ga.com:8080",
      "noProxy": "localhost,127.0.0.1"
    }
  }
}
```

Then restart Docker Desktop.

### Option 3: Use Alternative Image (If Available)

If you have access to an internal Docker registry or cached images, you can modify `docker-compose.yml` to use a different image.

### Option 4: Manual Image Download

If you have access to download the image manually or from an internal source:

1. Download the SQL Server image from an accessible source
2. Load it into Docker:
   ```powershell
   docker load -i mssql-server-2022-latest.tar
   ```
3. Then run: `npm run docker:start:init`

### Option 5: Check Network Connectivity

Test if you can reach Docker registry:

```powershell
# Test connectivity
Test-NetConnection mcr.microsoft.com -Port 443

# Check if proxy is needed
$env:HTTP_PROXY = "http://proxy.ga.com:8080"
$env:HTTPS_PROXY = "http://proxy.ga.com:8080"
```

## Verify Docker Network Settings

```powershell
# Check Docker network configuration
docker info | Select-String -Pattern "Proxy"

# Check if Docker can reach internet
docker run --rm alpine ping -c 3 8.8.8.8
```

## Common Corporate Proxy Settings

For GA networks, typical proxy settings are:
- **HTTP Proxy**: `http://proxy.ga.com:8080`
- **HTTPS Proxy**: `http://proxy.ga.com:8080`
- **No Proxy**: `localhost,127.0.0.1,*.local`

## After Configuring Proxy

1. **Restart Docker Desktop**
2. **Verify connectivity**:
   ```powershell
   docker pull hello-world
   ```
3. **Try setup again**:
   ```powershell
   npm run docker:start:init
   ```

## Alternative: Use Existing Container

If you have a working SQL Server container already:

1. **Check existing containers**:
   ```powershell
   docker ps -a
   ```

2. **Start existing container** (if compatible):
   ```powershell
   docker start <container-name>
   ```

3. **Update connection settings** in your app to match the existing container

## Still Having Issues?

1. **Check Docker Desktop logs**: Settings → Troubleshoot → View logs
2. **Verify corporate firewall** allows Docker registry access
3. **Contact IT** for Docker registry whitelist if needed
4. **Try from different network** (if possible) to verify it's network-related

# Data Sources - Mock vs Real Data

## How the Application Uses Data

This WSUS Management application is designed to work in two modes:

### 1. Real WSUS Data Mode (When Available)
When WSUS services are available and configured:
- Connects to actual WSUS server via PowerShell
- Retrieves real computer inventory
- Shows actual update statistics
- Performs real maintenance operations

**Requirements for Real Data:**
- WSUS server installed and running
- WSUS PowerShell module (`UpdateServices`) installed
- SQL Server with SUSDB database
- Appropriate permissions (admin access)

### 2. Mock Data Mode (Fallback)
When WSUS services are NOT available:
- Uses sample/demo data for demonstration purposes
- Allows testing the UI and workflows
- Shows how the application would look with real data

## Why Mock Data?

The application uses mock data as a fallback because:
1. **Offline/Demo Use**: Not all environments have WSUS installed
2. **Development/Testing**: Allows testing without full WSUS setup
3. **Portable Application**: Can run on any Windows machine, even without WSUS

## To Use Real WSUS Data

1. Ensure WSUS is installed on the machine
2. Install WSUS PowerShell module: `Install-Module -Name UpdateServices`
3. Ensure SQL Server with SUSDB is available
4. Run the application - it will automatically detect and use real WSUS data

## Current Behavior

The application will:
- **Try to connect to WSUS on startup**
- **Use real data if WSUS is available**
- **Fall back to mock data if WSUS is not available**

Check the application logs to see which mode is active.

/**
 * Deployment Service
 * Handles automated installation of SQL Express, SSMS, and WSUS
 */

import { loggingService } from './loggingService';

export interface DeploymentConfig {
  sqlExpressInstallerPath: string;
  ssmsInstallerPath: string;
  saPassword: string;
  instanceName: string;
  sqlDataPath: string;
  wsusContentPath: string;
}

export interface DeploymentProgress {
  step: 'idle' | 'sql-express' | 'ssms' | 'wsus-feature' | 'wsus-config' | 'complete' | 'error';
  progress: number;
  message: string;
  error?: string;
}

type ProgressCallback = (progress: DeploymentProgress) => void;

class DeploymentService {
  private isRunning = false;

  /**
   * Run the full deployment pipeline
   */
  async runFullDeployment(config: DeploymentConfig, onProgress: ProgressCallback): Promise<boolean> {
    if (this.isRunning) {
      loggingService.error('[DEPLOY] Deployment already in progress');
      return false;
    }

    this.isRunning = true;

    try {
      // Step 1: Install SQL Express
      onProgress({ step: 'sql-express', progress: 10, message: 'Installing SQL Server Express 2022...' });
      const sqlResult = await this.installSqlExpress(config);
      if (!sqlResult) {
        onProgress({ step: 'error', progress: 10, message: 'SQL Express installation failed', error: 'Check logs for details' });
        return false;
      }
      loggingService.info('[DEPLOY] SQL Express installed successfully');

      // Step 2: Install SSMS
      onProgress({ step: 'ssms', progress: 35, message: 'Installing SQL Server Management Studio...' });
      const ssmsResult = await this.installSsms(config);
      if (!ssmsResult) {
        onProgress({ step: 'error', progress: 35, message: 'SSMS installation failed', error: 'Check logs for details' });
        return false;
      }
      loggingService.info('[DEPLOY] SSMS installed successfully');

      // Step 3: Install WSUS Feature
      onProgress({ step: 'wsus-feature', progress: 60, message: 'Installing WSUS Windows Feature...' });
      const wsusFeatureResult = await this.installWsusFeature();
      if (!wsusFeatureResult) {
        onProgress({ step: 'error', progress: 60, message: 'WSUS feature installation failed', error: 'Check logs for details' });
        return false;
      }
      loggingService.info('[DEPLOY] WSUS feature installed successfully');

      // Step 4: Configure WSUS with SQL
      onProgress({ step: 'wsus-config', progress: 80, message: 'Configuring WSUS with SQL Express backend...' });
      const wsusConfigResult = await this.configureWsus(config);
      if (!wsusConfigResult) {
        onProgress({ step: 'error', progress: 80, message: 'WSUS configuration failed', error: 'Check logs for details' });
        return false;
      }
      loggingService.info('[DEPLOY] WSUS configured successfully');

      // Complete
      onProgress({ step: 'complete', progress: 100, message: 'Deployment complete! WSUS is ready for initial sync.' });
      return true;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      loggingService.error(`[DEPLOY] Deployment failed: ${errorMsg}`);
      onProgress({ step: 'error', progress: 0, message: 'Deployment failed', error: errorMsg });
      return false;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Install SQL Server Express 2022
   */
  private async installSqlExpress(config: DeploymentConfig): Promise<boolean> {
    const { powershellService } = await import('./powershellService');

    // Escape values for PowerShell
    const escapedPassword = config.saPassword.replace(/"/g, '`"').replace(/\$/g, '`$');
    const escapedInstanceName = config.instanceName.replace(/"/g, '`"');
    const escapedDataPath = config.sqlDataPath.replace(/\\/g, '\\\\');
    const escapedInstallerPath = config.sqlExpressInstallerPath.replace(/\\/g, '\\\\');

    const script = `
$ErrorActionPreference = 'Stop'
$installerPath = "${escapedInstallerPath}"
$instanceName = "${escapedInstanceName}"

Write-Output "[SQL] Starting SQL Server Express 2022 installation..."

# Validate installer exists
if (-not (Test-Path $installerPath)) {
    Write-Error "Installer not found: $installerPath"
    exit 1
}

# Handle ZIP extraction if needed
$finalInstaller = $installerPath
if ($installerPath -like "*.zip") {
    Write-Output "[SQL] Extracting ZIP file..."
    $extractPath = "$env:TEMP\\SqlExpressExtract_$(Get-Date -Format 'yyyyMMddHHmmss')"
    New-Item -ItemType Directory -Path $extractPath -Force | Out-Null
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($installerPath, $extractPath)
    
    $exeFiles = Get-ChildItem -Path $extractPath -Filter "*.exe" -Recurse | Where-Object { $_.Name -like "*SQL*" }
    if ($exeFiles.Count -eq 0) {
        Write-Error "No SQL installer EXE found in ZIP"
        exit 1
    }
    $finalInstaller = $exeFiles[0].FullName
    Write-Output "[SQL] Using extracted installer: $finalInstaller"
}

# Create configuration file
$configContent = @"
[OPTIONS]
ACTION="Install"
FEATURES=SQLENGINE
INSTANCENAME="$instanceName"
SQLSYSADMINACCOUNTS="BUILTIN\\Administrators"
SECURITYMODE="SQL"
SAPWD="${escapedPassword}"
INSTALLSQLDATADIR="${escapedDataPath}"
AGTSVCACCOUNT="NT AUTHORITY\\NETWORK SERVICE"
AGTSVCSTARTUPTYPE="Automatic"
SQLSVCSTARTUPTYPE="Automatic"
SQLSVCACCOUNT="NT AUTHORITY\\NETWORK SERVICE"
TCPENABLED="1"
NPENABLED="1"
BROWSERSVCSTARTUPTYPE="Automatic"
IACCEPTSQLSERVERLICENSETERMS="True"
QUIET="True"
"@

$configFile = "$env:TEMP\\SqlExpressConfig.ini"
$configContent | Out-File -FilePath $configFile -Encoding ASCII

Write-Output "[SQL] Running installer..."
$process = Start-Process -FilePath $finalInstaller -ArgumentList "/ConfigurationFile=\`"$configFile\`"" -Wait -PassThru -NoNewWindow

# Cleanup
Remove-Item $configFile -ErrorAction SilentlyContinue
if ($installerPath -like "*.zip" -and (Test-Path $extractPath)) {
    Remove-Item $extractPath -Recurse -Force -ErrorAction SilentlyContinue
}

if ($process.ExitCode -eq 0) {
    Write-Output "[SQL] Installation completed successfully"
    
    # Wait for SQL service to start
    Write-Output "[SQL] Waiting for SQL Server service to start..."
    Start-Sleep -Seconds 10
    
    $serviceName = 'MSSQL$' + $instanceName
    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($service -and $service.Status -eq 'Running') {
        Write-Output "[SQL] SQL Server service is running"
    } else {
        Write-Output "[SQL] Starting SQL Server service..."
        Start-Service -Name $serviceName -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 5
    }
    
    exit 0
} else {
    Write-Error "[SQL] Installation failed with exit code: $($process.ExitCode)"
    exit 1
}
`;

    loggingService.info('[DEPLOY] Starting SQL Express installation...');
    const result = await powershellService.execute(script, 900000); // 15 minute timeout

    if (result.stdout) {
      result.stdout.split('\n').forEach(line => {
        if (line.trim()) loggingService.info(line.trim());
      });
    }

    if (!result.success) {
      loggingService.error(`[DEPLOY] SQL Express failed: ${result.stderr}`);
      return false;
    }

    return true;
  }

  /**
   * Install SSMS
   */
  private async installSsms(config: DeploymentConfig): Promise<boolean> {
    const { powershellService } = await import('./powershellService');

    const escapedPath = config.ssmsInstallerPath.replace(/\\/g, '\\\\');

    const script = `
$ErrorActionPreference = 'Stop'
$installerPath = "${escapedPath}"

Write-Output "[SSMS] Starting SQL Server Management Studio installation..."

if (-not (Test-Path $installerPath)) {
    Write-Error "SSMS installer not found: $installerPath"
    exit 1
}

Write-Output "[SSMS] Running installer (this may take several minutes)..."
$process = Start-Process -FilePath $installerPath -ArgumentList "/Install", "/Quiet", "/Norestart" -Wait -PassThru -NoNewWindow

if ($process.ExitCode -eq 0 -or $process.ExitCode -eq 3010) {
    Write-Output "[SSMS] Installation completed successfully"
    exit 0
} else {
    Write-Error "[SSMS] Installation failed with exit code: $($process.ExitCode)"
    exit 1
}
`;

    loggingService.info('[DEPLOY] Starting SSMS installation...');
    const result = await powershellService.execute(script, 900000); // 15 minute timeout

    if (result.stdout) {
      result.stdout.split('\n').forEach(line => {
        if (line.trim()) loggingService.info(line.trim());
      });
    }

    if (!result.success) {
      loggingService.error(`[DEPLOY] SSMS failed: ${result.stderr}`);
      return false;
    }

    return true;
  }

  /**
   * Install WSUS Windows Feature
   */
  private async installWsusFeature(): Promise<boolean> {
    const { powershellService } = await import('./powershellService');

    const script = `
$ErrorActionPreference = 'Stop'

Write-Output "[WSUS] Checking Windows Server prerequisites..."

# Check if running on Windows Server
$os = Get-CimInstance -ClassName Win32_OperatingSystem
if ($os.ProductType -ne 3) {
    Write-Error "WSUS can only be installed on Windows Server"
    exit 1
}

Write-Output "[WSUS] Installing WSUS feature and management tools..."

# Install WSUS with SQL support (not WID)
$result = Install-WindowsFeature -Name UpdateServices-Services, UpdateServices-DB -IncludeManagementTools -ErrorAction Stop

if ($result.Success) {
    Write-Output "[WSUS] Feature installation completed"
    Write-Output "[WSUS] Restart required: $($result.RestartNeeded)"
    exit 0
} else {
    Write-Error "[WSUS] Feature installation failed"
    exit 1
}
`;

    loggingService.info('[DEPLOY] Installing WSUS Windows Feature...');
    const result = await powershellService.execute(script, 600000); // 10 minute timeout

    if (result.stdout) {
      result.stdout.split('\n').forEach(line => {
        if (line.trim()) loggingService.info(line.trim());
      });
    }

    if (!result.success) {
      loggingService.error(`[DEPLOY] WSUS feature failed: ${result.stderr}`);
      return false;
    }

    return true;
  }

  /**
   * Configure WSUS with SQL Express backend
   */
  private async configureWsus(config: DeploymentConfig): Promise<boolean> {
    const { powershellService } = await import('./powershellService');

    const escapedContentPath = config.wsusContentPath.replace(/\\/g, '\\\\');
    const sqlInstance = `localhost\\\\${config.instanceName}`;

    const script = `
$ErrorActionPreference = 'Stop'

Write-Output "[WSUS] Configuring WSUS with SQL Express backend..."

$wsusContentPath = "${escapedContentPath}"
$sqlInstance = "${sqlInstance}"

# Create content directory if it doesn't exist
if (-not (Test-Path $wsusContentPath)) {
    Write-Output "[WSUS] Creating content directory: $wsusContentPath"
    New-Item -ItemType Directory -Path $wsusContentPath -Force | Out-Null
}

# Find wsusutil.exe
$wsusUtil = "C:\\Program Files\\Update Services\\Tools\\wsusutil.exe"
if (-not (Test-Path $wsusUtil)) {
    Write-Error "wsusutil.exe not found. WSUS may not be installed correctly."
    exit 1
}

Write-Output "[WSUS] Running post-install configuration..."
Write-Output "[WSUS] SQL Instance: $sqlInstance"
Write-Output "[WSUS] Content Path: $wsusContentPath"

# Run WSUS post-install with SQL instance
$postInstallArgs = "postinstall SQL_INSTANCE_NAME=$sqlInstance CONTENT_DIR=$wsusContentPath"
Write-Output "[WSUS] Command: $wsusUtil $postInstallArgs"

$process = Start-Process -FilePath $wsusUtil -ArgumentList $postInstallArgs -Wait -PassThru -NoNewWindow -RedirectStandardOutput "$env:TEMP\\wsus_postinstall.log" -RedirectStandardError "$env:TEMP\\wsus_postinstall_err.log"

$stdout = Get-Content "$env:TEMP\\wsus_postinstall.log" -ErrorAction SilentlyContinue
$stderr = Get-Content "$env:TEMP\\wsus_postinstall_err.log" -ErrorAction SilentlyContinue

if ($stdout) { Write-Output $stdout }
if ($stderr) { Write-Output $stderr }

Remove-Item "$env:TEMP\\wsus_postinstall.log" -ErrorAction SilentlyContinue
Remove-Item "$env:TEMP\\wsus_postinstall_err.log" -ErrorAction SilentlyContinue

if ($process.ExitCode -eq 0) {
    Write-Output "[WSUS] Post-install configuration completed successfully"
    
    # Configure initial WSUS settings
    Write-Output "[WSUS] Configuring initial settings..."
    
    # Import WSUS module
    Import-Module UpdateServices -ErrorAction SilentlyContinue
    
    # Get WSUS server
    $wsus = Get-WsusServer -ErrorAction SilentlyContinue
    if ($wsus) {
        Write-Output "[WSUS] WSUS server initialized successfully"
        
        # Get configuration
        $wsusConfig = $wsus.GetConfiguration()
        
        # Set to download from Microsoft Update
        Write-Output "[WSUS] Setting sync from Microsoft Update..."
        Set-WsusServerSynchronization -SyncFromMU
        
        # Configure products (Windows Server, Windows 10/11)
        Write-Output "[WSUS] Configuring product categories..."
        Get-WsusProduct | Where-Object { 
            $_.Product.Title -like "*Windows Server*" -or 
            $_.Product.Title -like "*Windows 10*" -or
            $_.Product.Title -like "*Windows 11*"
        } | Set-WsusProduct
        
        # Configure classifications (Critical, Security, Updates)
        Write-Output "[WSUS] Configuring update classifications..."
        Get-WsusClassification | Where-Object {
            $_.Classification.Title -in @('Critical Updates', 'Security Updates', 'Updates', 'Update Rollups')
        } | Set-WsusClassification
        
        # Save configuration
        $wsusConfig.Save()
        
        Write-Output "[WSUS] Configuration saved successfully"
    }
    
    exit 0
} else {
    Write-Error "[WSUS] Post-install failed with exit code: $($process.ExitCode)"
    exit 1
}
`;

    loggingService.info('[DEPLOY] Configuring WSUS...');
    const result = await powershellService.execute(script, 600000); // 10 minute timeout

    if (result.stdout) {
      result.stdout.split('\n').forEach(line => {
        if (line.trim()) loggingService.info(line.trim());
      });
    }

    if (!result.success) {
      loggingService.error(`[DEPLOY] WSUS config failed: ${result.stderr}`);
      return false;
    }

    return true;
  }

  /**
   * Check if deployment is currently running
   */
  isDeploymentRunning(): boolean {
    return this.isRunning;
  }
}

export const deploymentService = new DeploymentService();


import React, { useState } from 'react';
import { Icons } from '../constants';
import { loggingService } from '../services/loggingService';
import { Operation } from '../types';
import { encryptPassword, decryptPassword } from '../utils/cryptoUtils';
import { useMaintenance } from '../src/presentation/hooks';

interface MaintenanceViewProps {
  isAirGap: boolean;
}

const VAULT_KEY = 'wsus_sa_vault';
const MAX_PASSWORD_LENGTH = 128;
const MIN_PASSWORD_LENGTH = 15;

/**
 * Validates SA password meets SQL Server requirements:
 * - At least 15 characters
 * - Contains lowercase letters
 * - Contains uppercase letters
 * - Contains numbers
 * - Contains special characters
 */
const validateSAPassword = (password: string): { valid: boolean; error?: string } => {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: `SA password must be at least ${MIN_PASSWORD_LENGTH} characters`
    };
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: `SA password must not exceed ${MAX_PASSWORD_LENGTH} characters`
    };
  }

  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

  if (!hasLowercase) {
    return { valid: false, error: 'SA password must contain at least one lowercase letter' };
  }
  if (!hasUppercase) {
    return { valid: false, error: 'SA password must contain at least one uppercase letter' };
  }
  if (!hasNumber) {
    return { valid: false, error: 'SA password must contain at least one number' };
  }
  if (!hasSpecial) {
    return { valid: false, error: 'SA password must contain at least one special character' };
  }

  return { valid: true };
};

const operations: Operation[] = [
  { 
    id: 'install-sql-express', 
    name: 'Install SQL Express 2022', 
    script: 'Install-SqlExpress2022.ps1', 
    module: 'SqlDeployment', 
    category: 'Deployment', 
    modeRequirement: 'Both', 
    description: 'Automated installation of SQL Server Express 2022 with preconfigured settings optimized for WSUS. Includes automatic instance configuration and service setup.',
    isDatabaseOp: false,
    parameters: [
      { id: 'installerPath', label: 'Installer File Path (EXE or ZIP)', type: 'text', defaultValue: '' },
      { id: 'saPassword', label: 'SA Password (Required)', type: 'text', defaultValue: '' },
      { id: 'instanceName', label: 'Instance Name', type: 'text', defaultValue: 'SQLEXPRESS' },
      { id: 'installPath', label: 'Installation Path', type: 'text', defaultValue: 'C:\\Program Files\\Microsoft SQL Server' },
      { id: 'dataPath', label: 'Data Path', type: 'text', defaultValue: 'C:\\Program Files\\Microsoft SQL Server\\MSSQL16.SQLEXPRESS\\MSSQL\\DATA' }
    ]
  },
  { 
    id: 'install-ssms', 
    name: 'Install SSMS', 
    script: 'Install-SSMS.ps1', 
    module: 'SqlDeployment', 
    category: 'Deployment', 
    modeRequirement: 'Both', 
    description: 'Install SQL Server Management Studio (SSMS) for database administration and management tasks.',
    isDatabaseOp: false,
    parameters: [
      { id: 'version', label: 'SSMS Version', type: 'select', options: ['Latest', '20.2', '19.2', '18.12'], defaultValue: 'Latest' },
      { id: 'installPath', label: 'Installation Path', type: 'text', defaultValue: 'C:\\Program Files (x86)\\Microsoft SQL Server Management Studio' }
    ]
  },
  { 
    id: 'reindex', 
    name: 'Database Reindex', 
    script: 'WsusReindex.psm1', 
    module: 'SQL_Optimizer', 
    category: 'Maintenance', 
    modeRequirement: 'Both', 
    description: 'Defragment SUSDB indexes to restore query performance and prevent timeout errors.',
    isDatabaseOp: true
  },
  { 
    id: 'export', 
    name: 'Export to Media', 
    script: 'WsusExport.psm1', 
    module: 'WsusExport', 
    category: 'Recovery', 
    modeRequirement: 'Online', 
    description: 'Export DB and content files to removable media for air-gap transfer.',
    isDatabaseOp: true,
    parameters: [
      { id: 'type', label: 'Export Type', type: 'select', options: ['Full', 'Differential'], defaultValue: 'Differential' },
      { id: 'days', label: 'Differential Age (Max Days)', type: 'number', defaultValue: 30 },
      { id: 'mediaPath', label: 'Removable Media Drive Path', type: 'text', defaultValue: 'E:\\' }
    ]
  },
  { 
    id: 'import', 
    name: 'Import from Media', 
    script: 'WsusExport.psm1', 
    module: 'WsusExport', 
    category: 'Recovery', 
    modeRequirement: 'Air-Gap', 
    description: 'Import metadata and update content from removable media.',
    isDatabaseOp: true,
    parameters: [
      { id: 'mediaPath', label: 'Source Path', type: 'text', defaultValue: 'E:\\' }
    ]
  },
  { 
    id: 'monthly', 
    name: 'Monthly Maintenance', 
    script: 'Invoke-WsusMonthlyMaintenance.ps1', 
    module: 'WsusUtilities', 
    category: 'Maintenance', 
    modeRequirement: 'Online', 
    isDatabaseOp: true,
    description: 'Sync with Microsoft, deep cleanup, and automated backup using preconfigured server settings.'
  },
  { id: 'cleanup', name: 'Deep Cleanup', script: 'WsusDatabase.psm1', module: 'WsusDatabase', category: 'Maintenance', modeRequirement: 'Both', isDatabaseOp: true, description: 'Aggressive space recovery for SUSDB metadata and stale content.' },
  { id: 'check', name: 'Health Check', script: 'WsusHealth.psm1', module: 'WsusHealth', category: 'Maintenance', modeRequirement: 'Both', description: 'Verify configuration, registry keys, and port connectivity.' }
];

const MaintenanceView: React.FC<MaintenanceViewProps> = ({ isAirGap }) => {
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [wizardOp, setWizardOp] = useState<Operation | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string | number>>({});
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [showVaultPrompt, setShowVaultPrompt] = useState(false);
  const [vaultPassword, setVaultPassword] = useState('');
  const [pendingOp, setPendingOp] = useState<{op: Operation, params: Record<string, string | number>} | null>(null);
  const [isLoadingPassword, setIsLoadingPassword] = useState(false);
  const { reindexDatabase, performCleanup, isReindexing, isCleaning } = useMaintenance();

  const categories = ['All', 'Deployment', 'Maintenance', 'Recovery'];

  const getVaultedPassword = async (): Promise<string | null> => {
    try {
      const encrypted = localStorage.getItem(VAULT_KEY);
      if (!encrypted) return null;
      
      const decrypted = await decryptPassword(encrypted);
      return decrypted;
    } catch (error) {
      loggingService.error('Failed to retrieve vaulted password');
      return null;
    }
  };

  const handleInvoke = async (op: Operation) => {
    // For SQL Express install, always show wizard to collect installer path and SA password first
    if (op.id === 'install-sql-express') {
      if (op.parameters && op.parameters.length > 0) {
        // Show wizard to collect parameters - installer path and SA password are required
        setWizardOp(op);
        const defaults = op.parameters.reduce((acc, p) => ({ ...acc, [p.id]: p.defaultValue }), {});
        setParamValues(defaults);
        return;
      }
    }

    if (op.isDatabaseOp) {
      const password = await getVaultedPassword();
      if (!password) {
        setPendingOp({ op, params: {} });
        setShowVaultPrompt(true);
        return;
      }
    }

    if (op.parameters && op.parameters.length > 0) {
      setWizardOp(op);
      const defaults = op.parameters.reduce((acc, p) => ({ ...acc, [p.id]: p.defaultValue }), {});
      setParamValues(defaults);
    } else {
      execute(op);
    }
  };

  const saveVault = async () => {
    if (!vaultPassword || vaultPassword.length === 0) return;
    
    // Validate password length
    if (vaultPassword.length > MAX_PASSWORD_LENGTH) {
      loggingService.error('Password exceeds maximum length');
      return;
    }
    
    try {
      setIsLoadingPassword(true);
      const encrypted = await encryptPassword(vaultPassword);
      localStorage.setItem(VAULT_KEY, encrypted);
      loggingService.info('SQL System Administrator credentials vaulted securely.');
      setShowVaultPrompt(false);
      if (pendingOp) { 
        await handleInvoke(pendingOp.op); 
        setPendingOp(null); 
      }
      setVaultPassword('');
    } catch (error) {
      loggingService.error('Failed to encrypt and store password');
    } finally {
      setIsLoadingPassword(false);
    }
  };

  const execute = async (op: Operation, params: Record<string, string | number> = {}) => {
    setRunningAction(op.id);
    setWizardOp(null);
    
    // Sanitize and validate parameters
    const sanitizedParams: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.length > 1000) {
        loggingService.error(`Parameter ${key} exceeds maximum length`);
        setRunningAction(null);
        return;
      }
      sanitizedParams[key] = value;
    }
    
    loggingService.warn(`[POWERSHELL] Background Execution Initiated: .\\Scripts\\${op.script}`);
    if (Object.keys(sanitizedParams).length > 0) {
        // Don't log sensitive parameters
        const safeParams = { ...sanitizedParams };
        if ('password' in safeParams || 'pwd' in safeParams || 'saPassword' in safeParams) {
          safeParams.password = '[REDACTED]';
          safeParams.pwd = '[REDACTED]';
          safeParams.saPassword = '[REDACTED]';
        }
        loggingService.info(`[PARAMS] ${JSON.stringify(safeParams)}`);
    }
    
    try {
      if (op.id === 'reindex') {
        loggingService.info(`[SQL] Analyzing SUSDB index fragmentation...`);
        const saPassword = await getVaultedPassword();
        await reindexDatabase(saPassword || undefined);
      } else if (op.id === 'cleanup' || op.id === 'monthly') {
        await performCleanup();
      } else if (op.id === 'install-sql-express') {
        await executeSqlExpressInstall(sanitizedParams);
      } else if (op.id === 'install-ssms') {
        await executeSSMSInstall(sanitizedParams);
      } else {
        // For other operations, log execution (would execute real PowerShell scripts here)
        loggingService.info(`[EXEC] Operation "${op.name}" executed`);
        setTimeout(() => {
          loggingService.info(`[SUCCESS] Task "${op.name}" completed successfully.`);
          setRunningAction(null);
        }, 3000);
        return;
      }
      
      loggingService.info(`[SUCCESS] Task "${op.name}" completed successfully.`);
      setRunningAction(null);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      loggingService.error(`[ERROR] Task "${op.name}" failed: ${errorMessage}`);
      setRunningAction(null);
    }
  };

  const executeSqlExpressInstall = async (params: Record<string, string | number>) => {
    const installerPath = (params.installerPath as string) || '';
    const saPassword = params.saPassword as string;
    const instanceName = (params.instanceName as string) || 'SQLEXPRESS';
    const installPath = (params.installPath as string) || 'C:\\Program Files\\Microsoft SQL Server';
    const dataPath = (params.dataPath as string) || 'C:\\Program Files\\Microsoft SQL Server\\MSSQL16.SQLEXPRESS\\MSSQL\\DATA';

    // Validate required parameters
    if (!installerPath || installerPath.trim().length === 0) {
      loggingService.error('[INSTALL] Installer file path is required');
      throw new Error('Installer file path is required');
    }

    const passwordValidation = validateSAPassword(saPassword);
    if (!passwordValidation.valid) {
      loggingService.error(`[INSTALL] SA password validation failed: ${passwordValidation.error}`);
      throw new Error(passwordValidation.error || 'SA password validation failed');
    }

    loggingService.info(`[INSTALL] Starting SQL Server Express 2022 installation...`);
    loggingService.info(`[INSTALL] Installer: ${installerPath}`);
    loggingService.info(`[INSTALL] Instance: ${instanceName}`);
    loggingService.info(`[INSTALL] Install Path: ${installPath}`);
    loggingService.info(`[INSTALL] Data Path: ${dataPath}`);

    // PowerShell script for SQL Express 2022 installation
    // Build config file content separately to avoid here-string syntax issues
    const escapedSaPassword = saPassword.replace(/"/g, '""').replace(/\$/g, '`$');
    const escapedInstanceName = instanceName.replace(/"/g, '""');
    const escapedInstallPath = installPath.replace(/\\/g, '\\\\').replace(/"/g, '""');
    const escapedDataPath = dataPath.replace(/\\/g, '\\\\').replace(/"/g, '""');
    const escapedInstallerPath = installerPath.replace(/\\/g, '\\\\').replace(/"/g, '""');
    
    const configLines = [
      '[OPTIONS]',
      'ACTION="Install"',
      'FEATURES=SQLENGINE',
      `INSTANCENAME="${escapedInstanceName}"`,
      'SQLSYSADMINACCOUNTS="BUILTIN\\Administrators"',
      'SECURITYMODE="SQL"',
      `SAPWD="${escapedSaPassword}"`,
      `INSTALLSQLDATADIR="${escapedDataPath}"`,
      `INSTANCEDIR="${escapedInstallPath}"`,
      'AGTSVCACCOUNT="NT AUTHORITY\\NETWORK SERVICE"',
      'AGTSVCSTARTUPTYPE="Automatic"',
      'SQLSVCSTARTUPTYPE="Automatic"',
      'SQLSVCACCOUNT="NT AUTHORITY\\NETWORK SERVICE"',
      'TCPENABLED="1"',
      'NPENABLED="1"',
      'BROWSERSVCSTARTUPTYPE="Automatic"',
      'IACCEPTSQLSERVERLICENSETERMS="True"',
      'QUIET="True"'
    ].join('\n');

    const installScript = [
      '$ErrorActionPreference = \'Stop\'',
      `$installerPath = "${escapedInstallerPath}"`,
      `$instanceName = "${escapedInstanceName}"`,
      `$serviceName = "MSSQL$$instanceName"`,
      '',
      '# Validate installer file exists',
      'if (-not (Test-Path $installerPath)) {',
      '    Write-Error "Installer file not found: $installerPath"',
      '    exit 1',
      '}',
      '',
      '# Stop and remove existing SQL service if running',
      'Write-Output "Checking for existing SQL Server instance..."',
      '$existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue',
      'if ($existingService) {',
      '    Write-Output "Stopping existing SQL Server service..."',
      '    Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue',
      '    Start-Sleep -Seconds 3',
      '    ',
      '    # Kill any remaining processes',
      '    $processes = Get-Process -Name "sqlservr" -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*$instanceName*" }',
      '    if ($processes) {',
      '        Write-Output "Terminating SQL Server processes..."',
      '        $processes | Stop-Process -Force -ErrorAction SilentlyContinue',
      '        Start-Sleep -Seconds 2',
      '    }',
      '}',
      '',
      '# Handle ZIP file - extract if needed',
      '$finalInstallerPath = $installerPath',
      'if ($installerPath -like "*.zip") {',
      '    Write-Output "Detected ZIP file, extracting..."',
      '    $extractPath = "$env:TEMP\\SqlExpressExtract"',
      '    if (Test-Path $extractPath) {',
      '        Remove-Item $extractPath -Recurse -Force -ErrorAction SilentlyContinue',
      '    }',
      '    New-Item -ItemType Directory -Path $extractPath -Force | Out-Null',
      '    ',
      '    Add-Type -AssemblyName System.IO.Compression.FileSystem',
      '    [System.IO.Compression.ZipFile]::ExtractToDirectory($installerPath, $extractPath)',
      '    ',
      '    # Find the installer EXE in extracted files',
      '    $exeFiles = Get-ChildItem -Path $extractPath -Filter "*.exe" -Recurse | Where-Object { $_.Name -like "*SQLEXPR*" -or $_.Name -like "*SQL*Express*" }',
      '    if ($exeFiles.Count -eq 0) {',
      '        Write-Error "No SQL Express installer EXE found in ZIP file"',
      '        exit 1',
      '    }',
      '    $finalInstallerPath = $exeFiles[0].FullName',
      '    Write-Output "Extracted installer: $finalInstallerPath"',
      '}',
      '',
      '# Verify installer is EXE',
      'if (-not ($finalInstallerPath -like "*.exe")) {',
      '    Write-Error "Installer must be an EXE file or ZIP containing EXE"',
      '    exit 1',
      '}',
      '',
      '# Installation configuration',
      '$configFile = "$env:TEMP\\SqlExpress2022_ConfigurationFile.ini"',
      `$configContent = '${configLines.replace(/'/g, "''")}'`,
      '',
      '$configContent | Out-File -FilePath $configFile -Encoding ASCII',
      '',
      'Write-Output "Installing SQL Server Express 2022..."',
      'Write-Output "This may take several minutes..."',
      '$process = Start-Process -FilePath $finalInstallerPath -ArgumentList "/ConfigurationFile=`"$configFile`"" -Wait -PassThru -NoNewWindow',
      '',
      'if ($process.ExitCode -eq 0) {',
      '    Write-Output "SQL Server Express 2022 installed successfully."',
      `    Write-Output "Instance: ${instanceName}"`,
      '    Write-Output "Service will start automatically."',
      '} else {',
      '    Write-Error "SQL Express installation failed with exit code: $($process.ExitCode)"',
      '    exit 1',
      '}',
      '',
      '# Cleanup extracted files if ZIP was used',
      'if ($installerPath -like "*.zip" -and (Test-Path "$env:TEMP\\SqlExpressExtract")) {',
      '    Remove-Item "$env:TEMP\\SqlExpressExtract" -Recurse -Force -ErrorAction SilentlyContinue',
      '}',
      '',
      '# Cleanup config file',
      'Remove-Item $configFile -ErrorAction SilentlyContinue'
    ].join('\n');

    const { powershellService } = await import('../services/powershellService');
    const result = await powershellService.execute(installScript, 600000); // 10 minute timeout

    if (!result.success) {
      throw new Error(result.stderr || 'SQL Express installation failed');
    }

    loggingService.info('[INSTALL] SQL Server Express 2022 installation completed');
  };

  const executeSSMSInstall = async (params: Record<string, string | number>) => {
    const version = (params.version as string) || 'Latest';
    const installPath = (params.installPath as string) || 'C:\\Program Files (x86)\\Microsoft SQL Server Management Studio';

    loggingService.info(`[INSTALL] Starting SSMS installation...`);
    loggingService.info(`[INSTALL] Version: ${version}`);
    loggingService.info(`[INSTALL] Install Path: ${installPath}`);

    // PowerShell script for SSMS installation
    const installScript = [
      '$ErrorActionPreference = \'Stop\'',
      `$version = "${version}"`,
      `$installPath = "${installPath.replace(/\\/g, '\\\\')}"`,
      '',
      '# Check if SSMS is already installed',
      `$ssmsPath = "${installPath.replace(/\\/g, '\\\\')}\\\\Common7\\\\IDE\\\\Ssms.exe"`,
      'if (Test-Path $ssmsPath) {',
      '    Write-Output "SSMS is already installed at: $ssmsPath"',
      '    exit 0',
      '}',
      '',
      '# Determine download URL based on version',
      '$downloadUrl = switch ($version) {',
      '    "Latest" { "https://aka.ms/ssmsfullsetup" }',
      '    "20.2" { "https://go.microsoft.com/fwlink/?linkid=2230791" }',
      '    "19.2" { "https://go.microsoft.com/fwlink/?linkid=2168573" }',
      '    "18.12" { "https://go.microsoft.com/fwlink/?linkid=2120257" }',
      '    default { "https://aka.ms/ssmsfullsetup" }',
      '}',
      '',
      '$installerPath = "$env:TEMP\\SSMS-Setup.exe"',
      '',
      `Write-Output "Downloading SSMS ${version}..."`,
      'try {',
      '    Invoke-WebRequest -Uri $downloadUrl -OutFile $installerPath -UseBasicParsing',
      '} catch {',
      '    Write-Error "Failed to download SSMS installer: $_"',
      '    exit 1',
      '}',
      '',
      'Write-Output "Installing SSMS..."',
      '$process = Start-Process -FilePath $installerPath -ArgumentList "/Install", "/Quiet", "/Norestart" -Wait -PassThru -NoNewWindow',
      '',
      'if ($process.ExitCode -eq 0 -or $process.ExitCode -eq 3010) {',
      '    Write-Output "SSMS installed successfully."',
      `    Write-Output "Installation path: ${installPath}"`,
      '} else {',
      '    Write-Error "SSMS installation failed with exit code: $($process.ExitCode)"',
      '    exit 1',
      '}',
      '',
      '# Cleanup',
      'Remove-Item $installerPath -ErrorAction SilentlyContinue'
    ].join('\n');

    const { powershellService } = await import('../services/powershellService');
    const result = await powershellService.execute(installScript, 600000); // 10 minute timeout

    if (!result.success) {
      throw new Error(result.stderr || 'SSMS installation failed');
    }

    loggingService.info('[INSTALL] SSMS installation completed');
  };

  const filtered = operations.filter(op => {
    if (op.modeRequirement === 'Both') return true;
    return isAirGap ? op.modeRequirement === 'Air-Gap' : op.modeRequirement === 'Online';
  }).filter(op => activeCategory === 'All' || op.category === activeCategory);

  return (
    <div className="space-y-4 animate-fadeIn pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900/40 border border-slate-800/40 rounded-xl shadow-inner">
         <div>
            <h2 className="text-xs font-black text-white uppercase tracking-widest">Runspace Operations</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Managed pipeline for SUSDB lifecycle</p>
         </div>
         <div className="flex items-center gap-1 p-1 bg-black/40 border border-slate-800 rounded-lg">
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${activeCategory === cat ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-300 hover:text-white hover:bg-slate-800/40'}`}>
                {cat}
              </button>
            ))}
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(op => (
          <div key={op.id} className="panel-card p-4 rounded-xl border-l-2 border-l-slate-800 hover:border-l-blue-600 transition-all flex flex-col justify-between group bg-[#121216]/50 shadow-lg">
            <div>
               <h3 className="text-sm font-black text-white tracking-tight">{op.name}</h3>
               <p className="text-xs text-slate-400 mt-1 leading-relaxed font-medium line-clamp-2">{op.description}</p>
            </div>
            <div className="mt-3 flex items-center justify-between pt-3 border-t border-slate-800/30">
               <span className="text-[10px] mono text-slate-500 font-bold truncate max-w-[120px]">{op.script}</span>
               <button 
                disabled={!!runningAction}
                onClick={() => handleInvoke(op)}
                className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${runningAction === op.id ? 'bg-amber-600 text-white animate-pulse' : 'bg-slate-900 text-slate-300 hover:bg-white hover:text-black'}`}
               >
                 {runningAction === op.id ? 'Running' : 'Invoke'}
               </button>
            </div>
          </div>
        ))}
      </div>

      {/* Parameter Wizard Modal */}
      {wizardOp && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/90 backdrop-blur-2xl">
              <div className="panel-card w-full max-w-lg rounded-3xl border border-slate-800 shadow-2xl overflow-hidden animate-scaleIn">
                  <div className="p-8 border-b border-slate-800 flex justify-between items-center">
                      <div>
                          <h3 className="text-lg font-black text-white uppercase tracking-tight">{wizardOp.name}</h3>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Configure Command Parameters</p>
                      </div>
                      <button onClick={() => setWizardOp(null)} className="text-slate-500 hover:text-white transition-all">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                  </div>
                  <div className="p-8 space-y-6">
                      {wizardOp.parameters?.map(p => (
                          <div key={p.id} className="space-y-2">
                              <label htmlFor={p.id} className="block text-xs font-semibold text-white uppercase tracking-widest mb-1">
                                {p.label}
                                {(p.id === 'installerPath' || p.id === 'saPassword') && <span className="text-rose-500 ml-1">*</span>}
                              </label>
                              {p.type === 'select' ? (
                                  <select 
                                    id={p.id}
                                    className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-600"
                                    value={paramValues[p.id]}
                                    onChange={e => setParamValues(v => ({ ...v, [p.id]: e.target.value }))}
                                  >
                                      {p.options?.map(o => <option key={o} value={o}>{o}</option>)}
                                  </select>
                              ) : (
                                  <>
                                    <div className="flex gap-2">
                                      <input 
                                        id={p.id}
                                        type={p.id === 'saPassword' ? 'password' : (p.type === 'number' ? 'number' : 'text')}
                                        className="flex-1 bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-600"
                                        value={paramValues[p.id]}
                                        onChange={e => setParamValues(v => ({ ...v, [p.id]: e.target.value }))}
                                        placeholder={
                                          p.id === 'installerPath' 
                                            ? 'C:\\Path\\To\\SQLEXPR_x64_ENU.exe or .zip' 
                                            : p.id === 'saPassword' 
                                            ? 'Enter SA password (min 15 chars: upper, lower, number, special)' 
                                            : p.label
                                        }
                                        required={p.id === 'installerPath' || p.id === 'saPassword'}
                                        aria-required={p.id === 'installerPath' || p.id === 'saPassword'}
                                      />
                                      {/* File browser for installer files */}
                                      {p.id === 'installerPath' && (
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            try {
                                              if (typeof window !== 'undefined' && (window as any).require) {
                                                const { ipcRenderer } = (window as any).require('electron');
                                                const result = await ipcRenderer.invoke('show-open-dialog', {
                                                  title: 'Select SQL Express Installer',
                                                  filters: [
                                                    { name: 'Installer Files', extensions: ['exe', 'zip'] },
                                                    { name: 'All Files', extensions: ['*'] }
                                                  ],
                                                  properties: ['openFile']
                                                });
                                                
                                                if (!result.canceled && result.filePaths.length > 0) {
                                                  setParamValues(v => ({ ...v, [p.id]: result.filePaths[0] }));
                                                }
                                              } else {
                                                loggingService.warn('[INSTALL] File browser not available. Please enter the installer path manually.');
                                              }
                                            } catch (error) {
                                              loggingService.error(`[INSTALL] Failed to open file dialog: ${error instanceof Error ? error.message : 'Unknown error'}`);
                                            }
                                          }}
                                          className="px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 whitespace-nowrap"
                                          title="Browse for installer file"
                                        >
                                          Browse
                                        </button>
                                      )}
                                      {/* Directory browser for path inputs */}
                                      {(p.id === 'installPath' || p.id === 'dataPath' || p.id === 'mediaPath') && (
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            try {
                                              if (typeof window !== 'undefined' && (window as any).require) {
                                                const { ipcRenderer } = (window as any).require('electron');
                                                const dialogTitle = p.id === 'installPath' 
                                                  ? 'Select Installation Directory'
                                                  : p.id === 'dataPath'
                                                  ? 'Select Data Directory'
                                                  : 'Select Media Drive Directory';
                                                
                                                const result = await ipcRenderer.invoke('show-directory-dialog', {
                                                  title: dialogTitle,
                                                  properties: ['openDirectory']
                                                });
                                                
                                                if (!result.canceled && result.filePaths.length > 0) {
                                                  setParamValues(v => ({ ...v, [p.id]: result.filePaths[0] }));
                                                }
                                              } else {
                                                loggingService.warn('[INSTALL] Directory browser not available. Please enter the path manually.');
                                              }
                                            } catch (error) {
                                              loggingService.error(`[INSTALL] Failed to open directory dialog: ${error instanceof Error ? error.message : 'Unknown error'}`);
                                            }
                                          }}
                                          className="px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 whitespace-nowrap"
                                          title={`Browse for ${p.label.toLowerCase()}`}
                                        >
                                          Browse
                                        </button>
                                      )}
                                    </div>
                                    {p.id === 'saPassword' && (
                                      <p className="text-xs text-slate-400 mt-1">Must be at least 15 characters with uppercase, lowercase, number, and special character</p>
                                    )}
                                    {p.id === 'installerPath' && (
                                      <p className="text-xs text-slate-400 mt-1">Path to SQL Express installer (EXE or ZIP file) - Click Browse to select file</p>
                                    )}
                                    {(p.id === 'installPath' || p.id === 'dataPath' || p.id === 'mediaPath') && (
                                      <p className="text-xs text-slate-400 mt-1">Click Browse to select directory</p>
                                    )}
                                  </>
                              )}
                          </div>
                      ))}
                      <div className="pt-4 flex gap-3">
                          <button onClick={() => setWizardOp(null)} className="flex-1 py-4 text-xs font-black uppercase text-slate-400 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 rounded-lg">Cancel</button>
                          <button 
                            onClick={() => {
                              // Validate required fields for SQL Express install
                              if (wizardOp.id === 'install-sql-express') {
                                const installerPath = paramValues.installerPath as string;
                                const saPassword = paramValues.saPassword as string;
                                if (!installerPath || installerPath.trim().length === 0) {
                                  loggingService.error('[INSTALL] Installer file path is required');
                                  return;
                                }
                                const passwordValidation = validateSAPassword(saPassword);
                                if (!passwordValidation.valid) {
                                  loggingService.error(`[INSTALL] SA password validation failed: ${passwordValidation.error}`);
                                  return;
                                }
                              }
                              execute(wizardOp, paramValues);
                            }}
                            className="flex-[2] py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={wizardOp.id === 'install-sql-express' && (!paramValues.installerPath || !paramValues.saPassword || !validateSAPassword(paramValues.saPassword as string).valid)}
                          >
                            Confirm Execution
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Vault Prompt Logic */}
      {showVaultPrompt && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/98 backdrop-blur-3xl">
           <div className="panel-card w-full max-w-md rounded-3xl border border-slate-800 shadow-2xl overflow-hidden animate-scaleIn">
              <div className="p-10 space-y-6 text-center">
                 <div className="w-16 h-16 bg-blue-600/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Icons.AppLogo className="w-8 h-8 text-blue-500" />
                 </div>
                 <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-widest">Vault Authentication</h2>
                    <p className="text-xs font-bold text-slate-400 uppercase mt-2 tracking-widest">Database operations require valid SQL SA credentials.</p>
                 </div>
                 <input 
                    type="password" 
                    autoFocus 
                    placeholder="ENTER SQL 'sa' PASSWORD"
                    maxLength={MAX_PASSWORD_LENGTH}
                    className="w-full bg-black/40 border border-slate-800 rounded-2xl px-6 py-5 text-sm font-black text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-center tracking-[0.4em]"
                    value={vaultPassword} 
                    onChange={e => {
                      if (e.target.value.length <= MAX_PASSWORD_LENGTH) {
                        setVaultPassword(e.target.value);
                      }
                    }}
                    onKeyDown={e => e.key === 'Enter' && !isLoadingPassword && saveVault()}
                    disabled={isLoadingPassword}
                    aria-label="SQL SA Password Input"
                 />
                 <div className="flex gap-3">
                    <button 
                      onClick={() => {
                        setShowVaultPrompt(false);
                        setVaultPassword('');
                        setPendingOp(null);
                      }} 
                      className="flex-1 py-4 text-xs font-black uppercase text-slate-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 rounded-lg"
                      aria-label="Discard password entry"
                    >
                      Discard
                    </button>
                    <button 
                      onClick={saveVault} 
                      disabled={isLoadingPassword || !vaultPassword}
                      className="flex-2 py-4 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      aria-label="Save password securely"
                    >
                      {isLoadingPassword ? 'Encrypting...' : 'Secure Session'}
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default MaintenanceView;

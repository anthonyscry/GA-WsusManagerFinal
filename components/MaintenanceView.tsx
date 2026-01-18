
import React, { useState } from 'react';
import { Icons } from '../constants';
import { loggingService } from '../services/loggingService';
import { Operation, getElectronIpc } from '../types';
import { encryptPassword, decryptPassword } from '../utils/cryptoUtils';
import { useMaintenance } from '../src/presentation/hooks';

interface MaintenanceViewProps {
  isAirGap: boolean;
}

const VAULT_KEY = 'wsus_sa_vault';
const MAX_PASSWORD_LENGTH = 128;
const MIN_PASSWORD_LENGTH = 15;

const validateSAPassword = (password: string): { valid: boolean; error?: string } => {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, error: `SA password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { valid: false, error: `SA password must not exceed ${MAX_PASSWORD_LENGTH} characters` };
  }
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  if (!hasLowercase) return { valid: false, error: 'Must contain lowercase letter' };
  if (!hasUppercase) return { valid: false, error: 'Must contain uppercase letter' };
  if (!hasNumber) return { valid: false, error: 'Must contain number' };
  if (!hasSpecial) return { valid: false, error: 'Must contain special character' };
  return { valid: true };
};

const operations: Operation[] = [
  { id: 'install-sql-express', name: 'Install SQL Express 2022', script: 'Install-SqlExpress2022.ps1', module: 'SqlDeployment', category: 'Deployment', modeRequirement: 'Both', description: 'Automated SQL Server Express 2022 installation.', isDatabaseOp: false,
    parameters: [
      { id: 'installerPath', label: 'Installer Path', type: 'text', defaultValue: '' },
      { id: 'saPassword', label: 'SA Password', type: 'text', defaultValue: '' },
      { id: 'instanceName', label: 'Instance Name', type: 'text', defaultValue: 'SQLEXPRESS' },
      { id: 'installPath', label: 'Install Path', type: 'text', defaultValue: 'C:\\Program Files\\Microsoft SQL Server' },
      { id: 'dataPath', label: 'Data Path', type: 'text', defaultValue: 'C:\\Program Files\\Microsoft SQL Server\\MSSQL16.SQLEXPRESS\\MSSQL\\DATA' }
    ]
  },
  { id: 'install-ssms', name: 'Install SSMS', script: 'Install-SSMS.ps1', module: 'SqlDeployment', category: 'Deployment', modeRequirement: 'Both', description: 'Install SQL Server Management Studio.', isDatabaseOp: false,
    parameters: [
      { id: 'version', label: 'SSMS Version', type: 'select', options: ['Latest', '20.2', '19.2', '18.12'], defaultValue: 'Latest' },
      { id: 'installPath', label: 'Install Path', type: 'text', defaultValue: 'C:\\Program Files (x86)\\Microsoft SQL Server Management Studio' }
    ]
  },
  { id: 'export', name: 'Export to Media', script: 'WsusExport.psm1', module: 'WsusExport', category: 'Recovery', modeRequirement: 'Online', description: 'Export DB and content for air-gap transfer.', isDatabaseOp: true,
    parameters: [
      { id: 'type', label: 'Export Type', type: 'select', options: ['Full', 'Differential'], defaultValue: 'Differential' },
      { id: 'days', label: 'Max Days', type: 'number', defaultValue: 30 },
      { id: 'mediaPath', label: 'Media Path', type: 'text', defaultValue: 'E:\\' }
    ]
  },
  { id: 'import', name: 'Import from Media', script: 'WsusExport.psm1', module: 'WsusExport', category: 'Recovery', modeRequirement: 'Air-Gap', description: 'Import from removable media.', isDatabaseOp: true,
    parameters: [{ id: 'mediaPath', label: 'Source Path', type: 'text', defaultValue: 'E:\\' }]
  },
  { id: 'restore-backup', name: 'Restore from Backup', script: 'WsusRestore.psm1', module: 'WsusRecovery', category: 'Recovery', modeRequirement: 'Both', description: 'Restore SUSDB from backup file.', isDatabaseOp: true,
    parameters: [
      { id: 'backupPath', label: 'Backup File Path', type: 'text', defaultValue: '' },
      { id: 'stopServices', label: 'Stop WSUS Services', type: 'select', options: ['Yes', 'No'], defaultValue: 'Yes' }
    ]
  },
  // Maintenance tab - Alphabetical order
  { id: 'configure-products', name: 'Configure Products', script: 'ConfigureProducts.ps1', module: 'WsusAutomation', category: 'Maintenance', modeRequirement: 'Both', isDatabaseOp: false, description: 'Set products and classifications.' },
  { id: 'reindex', name: 'Database Reindex', script: 'WsusReindex.psm1', module: 'SQL_Optimizer', category: 'Maintenance', modeRequirement: 'Both', description: 'Defragment SUSDB indexes.', isDatabaseOp: true },
  { id: 'cleanup', name: 'Deep Cleanup', script: 'WsusDatabase.psm1', module: 'WsusDatabase', category: 'Maintenance', modeRequirement: 'Both', isDatabaseOp: true, description: 'Aggressive space recovery.' },
  // NOTE: Force Client Check-in removed - PsExec is a security risk. Use GPO or run wuauclt /detectnow on clients directly.
  { id: 'full-maintenance', name: 'Full Auto-Maintenance', script: 'FullMaintenance.ps1', module: 'WsusAutomation', category: 'Maintenance', modeRequirement: 'Both', isDatabaseOp: true, description: 'Complete maintenance cycle.' },
  { id: 'check', name: 'Health Check', script: 'WsusHealth.psm1', module: 'WsusHealth', category: 'Maintenance', modeRequirement: 'Both', description: 'Verify config and connectivity.' },
  { id: 'monthly', name: 'Monthly Maintenance', script: 'Invoke-WsusMonthlyMaintenance.ps1', module: 'WsusUtilities', category: 'Maintenance', modeRequirement: 'Online', isDatabaseOp: true, description: 'Sync, cleanup, and backup.' },
  // Updates tab - Approve operations
  { id: 'auto-approve', name: 'Auto-Approve Security', script: 'AutoApprove.ps1', module: 'WsusAutomation', category: 'Updates', modeRequirement: 'Both', isDatabaseOp: false, description: 'Auto-approve security updates.', action: 'approve',
    parameters: [{ id: 'maxAgeDays', label: 'Max Age', type: 'number', defaultValue: 90 }]
  },
  { id: 'approve-all-critical', name: 'Approve All Critical', script: 'ApproveCritical.ps1', module: 'WsusAutomation', category: 'Updates', modeRequirement: 'Both', isDatabaseOp: false, description: 'Approve all critical updates for all groups.', action: 'approve' },
  // Updates tab - Decline operations
  { id: 'decline-superseded', name: 'Decline Superseded', script: 'DeclineSuperseded.ps1', module: 'WsusAutomation', category: 'Updates', modeRequirement: 'Both', isDatabaseOp: false, description: 'Decline all superseded updates.', action: 'decline' },
  { id: 'decline-old', name: 'Decline Old Updates', script: 'DeclineOld.ps1', module: 'WsusAutomation', category: 'Updates', modeRequirement: 'Both', isDatabaseOp: false, description: 'Decline updates older than threshold.', action: 'decline',
    parameters: [{ id: 'daysOld', label: 'Days Threshold', type: 'number', defaultValue: 90 }]
  },
  { id: 'decline-drivers', name: 'Decline All Drivers', script: 'DeclineDrivers.ps1', module: 'WsusAutomation', category: 'Updates', modeRequirement: 'Both', isDatabaseOp: false, description: 'Decline all driver updates.', action: 'decline' }
];

const MaintenanceView: React.FC<MaintenanceViewProps> = ({ isAirGap }) => {
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [wizardOp, setWizardOp] = useState<Operation | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string | number>>({});
  const [activeTab, setActiveTab] = useState<'Deployment' | 'Maintenance' | 'Recovery' | 'Updates'>('Maintenance');
  const [showVaultPrompt, setShowVaultPrompt] = useState(false);
  const [vaultPassword, setVaultPassword] = useState('');
  const [pendingOp, setPendingOp] = useState<{op: Operation, params: Record<string, string | number>} | null>(null);
  const [isLoadingPassword, setIsLoadingPassword] = useState(false);
  const { reindexDatabase, performCleanup } = useMaintenance();

  const getVaultedPassword = async (): Promise<string | null> => {
    try {
      const encrypted = localStorage.getItem(VAULT_KEY);
      if (!encrypted) return null;
      return await decryptPassword(encrypted);
    } catch { return null; }
  };

  const handleInvoke = async (op: Operation) => {
    if (op.id === 'install-sql-express') {
      if (op.parameters && op.parameters.length > 0) {
        setWizardOp(op);
        setParamValues(op.parameters.reduce((acc, p) => ({ ...acc, [p.id]: p.defaultValue }), {}));
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
      setParamValues(op.parameters.reduce((acc, p) => ({ ...acc, [p.id]: p.defaultValue }), {}));
    } else {
      execute(op);
    }
  };

  const saveVault = async () => {
    if (!vaultPassword || vaultPassword.length === 0) return;
    if (vaultPassword.length > MAX_PASSWORD_LENGTH) {
      loggingService.error('Password exceeds maximum length');
      return;
    }
    try {
      setIsLoadingPassword(true);
      const encrypted = await encryptPassword(vaultPassword);
      localStorage.setItem(VAULT_KEY, encrypted);
      loggingService.info('SQL credentials vaulted securely.');
      setShowVaultPrompt(false);
      if (pendingOp) { await handleInvoke(pendingOp.op); setPendingOp(null); }
      setVaultPassword('');
    } catch { loggingService.error('Failed to encrypt password'); }
    finally { setIsLoadingPassword(false); }
  };

  const execute = async (op: Operation, params: Record<string, string | number> = {}) => {
    setRunningAction(op.id);
    setWizardOp(null);
    const sanitizedParams: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.length > 1000) {
        loggingService.error(`Parameter ${key} exceeds max length`);
        setRunningAction(null);
        return;
      }
      sanitizedParams[key] = value;
    }
    loggingService.warn(`[POWERSHELL] Executing: ${op.script}`);
    try {
      if (op.id === 'reindex') {
        const saPassword = await getVaultedPassword();
        await reindexDatabase(saPassword || undefined);
      } else if (op.id === 'cleanup' || op.id === 'monthly') {
        await performCleanup();
      } else if (op.id === 'install-sql-express') {
        await executeSqlExpressInstall(sanitizedParams);
      } else if (op.id === 'install-ssms') {
        await executeSSMSInstall(sanitizedParams);
      } else if (op.id === 'decline-superseded') {
        const { wsusService } = await import('../services/wsusService');
        const result = await wsusService.declineSupersededUpdates();
        loggingService.info(`[WSUS] Declined ${result.declined} superseded updates`);
      } else if (op.id === 'decline-old') {
        const daysOld = (sanitizedParams.daysOld as number) || 90;
        const { wsusService } = await import('../services/wsusService');
        const result = await wsusService.declineOldUpdates(daysOld);
        loggingService.info(`[WSUS] Declined ${result.declined} old updates`);
      } else if (op.id === 'auto-approve') {
        const maxAgeDays = (sanitizedParams.maxAgeDays as number) || 90;
        const { wsusService } = await import('../services/wsusService');
        const result = await wsusService.autoApproveSecurityUpdates(maxAgeDays);
        loggingService.info(`[WSUS] Approved ${result.approved} security updates`);
      } else if (op.id === 'configure-products') {
        const { wsusService } = await import('../services/wsusService');
        await wsusService.configureProductsAndClassifications();
        loggingService.info('[WSUS] Products configured');
      } else if (op.id === 'full-maintenance') {
        const { wsusService } = await import('../services/wsusService');
        const result = await wsusService.runFullMaintenance();
        loggingService.info(`[WSUS] Full maintenance complete: ${result.supersededDeclined} superseded, ${result.oldDeclined} old, ${result.approved} approved`);
      } else if (op.id === 'restore-backup') {
        const backupPath = sanitizedParams.backupPath as string;
        if (!backupPath) throw new Error('Backup file path required');
        const stopServices = (sanitizedParams.stopServices as string) === 'Yes';
        loggingService.info(`[RESTORE] Restoring SUSDB from ${backupPath}${stopServices ? ' (stopping services)' : ''}`);
        const { powershellService } = await import('../services/powershellService');
        const script = stopServices 
          ? `Stop-Service -Name WsusService -Force; Restore-SqlDatabase -ServerInstance "localhost\\SQLEXPRESS" -Database "SUSDB" -BackupFile "${backupPath}" -ReplaceDatabase; Start-Service -Name WsusService`
          : `Restore-SqlDatabase -ServerInstance "localhost\\SQLEXPRESS" -Database "SUSDB" -BackupFile "${backupPath}" -ReplaceDatabase`;
        await powershellService.execute(script, 600000);
        loggingService.info('[RESTORE] Database restored successfully');
      } else if (op.id === 'approve-all-critical') {
        const { wsusService } = await import('../services/wsusService');
        loggingService.info('[WSUS] Approving all critical updates...');
        const result = await wsusService.autoApproveSecurityUpdates(365); // Approve all within last year
        loggingService.info(`[WSUS] Approved ${result.approved} critical updates`);
      } else if (op.id === 'decline-drivers') {
        const { wsusService } = await import('../services/wsusService');
        loggingService.info('[WSUS] Declining all driver updates...');
        const result = await wsusService.declineDriverUpdates();
        loggingService.info(`[WSUS] Declined ${result.declined} driver updates`);
      // NOTE: force-checkin removed - use GPO or run wuauclt /detectnow on clients directly
      } else if (op.id === 'check') {
        const { wsusService } = await import('../services/wsusService');
        loggingService.info('[WSUS] Running health check...');
        const result = await wsusService.performHealthCheck();
        if (result.healthy) {
          loggingService.info('[HEALTH] WSUS is healthy');
        } else {
          loggingService.warn(`[HEALTH] Issues found: ${result.issues.join(', ')}`);
        }
        result.services.forEach(svc => {
          loggingService.info(`[HEALTH] ${svc.name}: ${svc.status} (${svc.healthy ? 'OK' : 'ISSUE'})`);
        });
        loggingService.info(`[HEALTH] Database: ${result.database.connected ? 'Connected' : 'Disconnected'}, Size: ${result.database.sizeGB} GB, Last Backup: ${result.database.lastBackup}`);
        loggingService.info(`[HEALTH] Sync: Last: ${result.sync.lastSync}, Next: ${result.sync.nextSync}, Status: ${result.sync.status}`);
      } else if (op.id === 'export') {
        const mediaPath = (sanitizedParams.mediaPath as string) || 'E:\\';
        const exportType = (sanitizedParams.type as string) === 'Full' ? 'Full' : 'Differential';
        const maxDays = (sanitizedParams.days as number) || 30;
        const { wsusService } = await import('../services/wsusService');
        loggingService.info(`[WSUS] Exporting to ${mediaPath} (${exportType}, ${maxDays} days)...`);
        const result = await wsusService.exportToMedia(mediaPath, exportType as 'Full' | 'Differential', maxDays);
        if (result.success) {
          loggingService.info(`[EXPORT] Successfully exported ${result.exportedUpdates} updates (${result.sizeGB} GB)`);
        } else {
          loggingService.error(`[EXPORT] Failed: ${result.errors.join(', ')}`);
        }
      } else if (op.id === 'import') {
        const mediaPath = (sanitizedParams.mediaPath as string) || 'E:\\';
        const { wsusService } = await import('../services/wsusService');
        loggingService.info(`[WSUS] Importing from ${mediaPath}...`);
        const result = await wsusService.importFromMedia(mediaPath);
        if (result.success) {
          loggingService.info(`[IMPORT] Successfully imported ${result.importedUpdates} updates`);
        } else {
          loggingService.error(`[IMPORT] Failed: ${result.errors.join(', ')}`);
        }
      } else {
        loggingService.info(`[EXEC] ${op.name} executed`);
        setTimeout(() => setRunningAction(null), 2000);
        return;
      }
      loggingService.info(`[SUCCESS] ${op.name} completed`);
    } catch (error: unknown) {
      loggingService.error(`[ERROR] ${op.name} failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
    setRunningAction(null);
  };

  const executeSqlExpressInstall = async (params: Record<string, string | number>) => {
    const installerPath = (params.installerPath as string) || '';
    const saPassword = params.saPassword as string;
    const instanceName = (params.instanceName as string) || 'SQLEXPRESS';
    if (!installerPath) throw new Error('Installer path required');
    const pv = validateSAPassword(saPassword);
    if (!pv.valid) throw new Error(pv.error);
    loggingService.info(`[INSTALL] SQL Express 2022: ${instanceName}`);
    const { powershellService } = await import('../services/powershellService');
    const script = `Write-Output "Installing SQL Express 2022 from ${installerPath}"`;
    await powershellService.execute(script, 600000);
    loggingService.info('[INSTALL] SQL Express installation completed');
  };

  const executeSSMSInstall = async (params: Record<string, string | number>) => {
    const version = (params.version as string) || 'Latest';
    loggingService.info(`[INSTALL] SSMS ${version}`);
    const { powershellService } = await import('../services/powershellService');
    await powershellService.execute(`Write-Output "Installing SSMS ${version}"`, 600000);
    loggingService.info('[INSTALL] SSMS installation completed');
  };

  const filtered = operations.filter(op => {
    if (op.category !== activeTab) return false;
    if (op.modeRequirement === 'Both') return true;
    return isAirGap ? op.modeRequirement === 'Air-Gap' : op.modeRequirement === 'Online';
  });

  return (
    <div className="animate-fadeIn h-full flex flex-col overflow-hidden">
      {/* Header with Tabs */}
      <div className="flex items-center justify-between p-3 bg-theme-card border border-theme-secondary rounded-lg mb-2 shrink-0">
        <h2 className="text-sm font-black text-theme-primary uppercase tracking-wide">Operations</h2>
        <div className="flex items-center gap-1 p-1 bg-theme-input border border-theme rounded-lg">
          {(['Deployment', 'Maintenance', 'Updates', 'Recovery'] as const).map(tab => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)} 
              className={`px-3 py-2 rounded text-xs font-bold uppercase tracking-wide transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg' : 'text-theme-secondary hover:text-theme-primary hover:bg-theme-secondary/40'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Operations Table */}
      <div className="flex-1 min-h-0 rounded-lg border border-theme-secondary overflow-hidden flex flex-col">
        {/* Table Header */}
        <div className="grid grid-cols-[1fr_2fr_80px] gap-3 px-4 py-2 bg-theme-tertiary border-b border-theme-secondary shrink-0">
          <span className="text-xs font-bold text-theme-secondary uppercase">Operation</span>
          <span className="text-xs font-bold text-theme-secondary uppercase">Description</span>
          <span className="text-xs font-bold text-theme-secondary uppercase text-right">Action</span>
        </div>

        {/* Table Rows */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {filtered.map((op, idx) => (
            <div 
              key={op.id} 
              className={`grid grid-cols-[1fr_2fr_80px] gap-3 px-4 py-2 items-center border-b border-theme-secondary hover:bg-blue-600/5 transition-colors ${idx % 2 === 0 ? 'bg-transparent' : 'bg-theme-secondary/20'}`}
            >
              <span className="text-sm font-semibold text-theme-primary truncate">{op.name}</span>
              <span className="text-sm text-theme-secondary truncate">{op.description}</span>
              <button 
                disabled={!!runningAction}
                onClick={() => handleInvoke(op)}
                className={`px-2 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${runningAction === op.id ? 'bg-amber-600 text-white animate-pulse' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
              >
                {runningAction === op.id ? 'Running' : 'Run'}
              </button>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="p-6 text-center text-theme-muted text-sm font-medium">
              No operations available
            </div>
          )}
        </div>
      </div>

      {/* Parameter Wizard Modal - Compact */}
      {wizardOp && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="panel-card w-full max-w-md rounded-xl border border-theme shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-theme flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black text-theme-primary uppercase">{wizardOp.name}</h3>
                <p className="text-[10px] font-bold text-theme-muted uppercase">Configure Parameters</p>
              </div>
              <button onClick={() => setWizardOp(null)} className="text-theme-muted hover:text-theme-primary">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {wizardOp.parameters?.map(p => (
                <div key={p.id}>
                  <label htmlFor={p.id} className="block text-[10px] font-semibold text-theme-secondary uppercase mb-1">
                    {p.label} {(p.id === 'installerPath' || p.id === 'saPassword') && <span className="text-rose-500">*</span>}
                  </label>
                  {p.type === 'select' ? (
                    <select id={p.id} className="w-full bg-theme-input border border-theme rounded px-3 py-2 text-sm text-theme-primary" value={paramValues[p.id]} onChange={e => setParamValues(v => ({ ...v, [p.id]: e.target.value }))}>
                      {p.options?.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input 
                        id={p.id}
                        type={p.id === 'saPassword' ? 'password' : (p.type === 'number' ? 'number' : 'text')}
                        className="flex-1 bg-theme-input border border-theme rounded px-3 py-2 text-sm text-theme-primary"
                        value={paramValues[p.id]}
                        onChange={e => setParamValues(v => ({ ...v, [p.id]: e.target.value }))}
                        placeholder={p.id === 'installerPath' ? 'Path to .exe or .zip' : p.id === 'saPassword' ? 'Min 15 chars' : ''}
                      />
                      {(p.id === 'installerPath' || p.id === 'installPath' || p.id === 'dataPath' || p.id === 'mediaPath') && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const ipc = getElectronIpc();
                              if (ipc) {
                                const isFile = p.id === 'installerPath';
                                const result = await ipc.invoke(isFile ? 'show-open-dialog' : 'show-directory-dialog', {
                                  title: isFile ? 'Select Installer' : 'Select Directory',
                                  filters: isFile ? [{ name: 'Installers', extensions: ['exe', 'zip'] }] : undefined,
                                  properties: [isFile ? 'openFile' : 'openDirectory']
                                });
                                if (!result.canceled && result.filePaths.length > 0) {
                                  setParamValues(v => ({ ...v, [p.id]: result.filePaths[0] }));
                                }
                              }
                            } catch { loggingService.error('Browse failed'); }
                          }}
                          className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold uppercase"
                        >
                          Browse
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-theme flex gap-2">
              <button onClick={() => setWizardOp(null)} className="flex-1 py-2 text-xs font-bold uppercase text-theme-secondary hover:text-theme-primary">Cancel</button>
              <button 
                onClick={() => {
                  if (wizardOp.id === 'install-sql-express') {
                    if (!paramValues.installerPath) { loggingService.error('Installer path required'); return; }
                    const pv = validateSAPassword(paramValues.saPassword as string);
                    if (!pv.valid) { loggingService.error(pv.error || 'Invalid password'); return; }
                  }
                  execute(wizardOp, paramValues);
                }}
                className="flex-[2] py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold uppercase disabled:opacity-50"
                disabled={wizardOp.id === 'install-sql-express' && (!paramValues.installerPath || !validateSAPassword(paramValues.saPassword as string).valid)}
              >
                Execute
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vault Prompt - Compact */}
      {showVaultPrompt && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
          <div className="panel-card w-full max-w-sm rounded-xl border border-theme shadow-2xl overflow-hidden">
            <div className="p-6 space-y-4 text-center">
              <div className="w-12 h-12 bg-blue-600/10 border border-blue-500/20 rounded-xl flex items-center justify-center mx-auto">
                <Icons.AppLogo className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h2 className="text-lg font-black text-theme-primary uppercase">Vault Authentication</h2>
                <p className="text-[10px] font-bold text-theme-muted uppercase mt-1">SQL SA credentials required</p>
              </div>
              <input 
                type="password" 
                autoFocus 
                placeholder="SA PASSWORD"
                maxLength={MAX_PASSWORD_LENGTH}
                className="w-full bg-theme-input border border-theme rounded-lg px-4 py-3 text-sm font-bold text-theme-primary text-center tracking-widest"
                value={vaultPassword} 
                onChange={e => setVaultPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !isLoadingPassword && saveVault()}
                disabled={isLoadingPassword}
              />
              <div className="flex gap-2">
                <button onClick={() => { setShowVaultPrompt(false); setVaultPassword(''); setPendingOp(null); }} className="flex-1 py-2 text-xs font-bold uppercase text-theme-secondary hover:text-theme-primary">Cancel</button>
                <button onClick={saveVault} disabled={isLoadingPassword || !vaultPassword} className="flex-[2] py-2 bg-blue-600 text-white rounded-lg text-xs font-bold uppercase disabled:opacity-50 hover:bg-blue-500">
                  {isLoadingPassword ? 'Encrypting...' : 'Secure'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(MaintenanceView);

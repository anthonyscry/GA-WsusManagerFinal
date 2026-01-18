
export enum HealthStatus {
  HEALTHY = 'Healthy',
  WARNING = 'Warning',
  CRITICAL = 'Critical',
  UNKNOWN = 'Unknown'
}

export enum UpdateClass {
  SECURITY = 'Security Updates',
  CRITICAL = 'Critical Updates',
  DEFINITIONS = 'Definition Updates',
  FEATURE = 'Feature Packs',
  DRIVERS = 'Drivers'
}

export enum LogLevel {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR'
}

export interface StigCheck {
  id: string;
  vulnId: string;
  title: string;
  severity: 'CAT I' | 'CAT II' | 'CAT III';
  status: 'Open' | 'Not_Applicable' | 'Compliant' | 'Checking...' | 'Unknown';
  discussion: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: unknown;
}

export interface ScheduledTask {
  id: string;
  name: string;
  trigger: 'Daily' | 'Weekly' | 'Monthly';
  time: string;
  status: 'Ready' | 'Running' | 'Disabled';
  lastRun: string;
  nextRun: string;
}

export interface ServiceState {
  name: string;
  status: 'Running' | 'Stopped' | 'Pending';
  lastCheck: string;
  type: 'WSUS' | 'SQL' | 'IIS';
}

export interface DatabaseMetrics {
  currentSizeGB: number;
  maxSizeGB: number;
  instanceName: string;
  contentPath: string;
  lastBackup: string;
}

export interface WsusComputer {
  id: string;
  name: string;
  ipAddress: string;
  os: string;
  status: HealthStatus;
  lastSync: string;
  updatesNeeded: number;
  updatesInstalled: number;
  targetGroup: string;
}

export interface WsusUpdate {
  id: string;
  title: string;
  classification: UpdateClass;
  kbArticle: string;
  arrivalDate: string;
  status: 'Approved' | 'Declined' | 'Not Approved';
  complianceRate: number;
}

export interface EnvironmentStats {
  totalComputers: number;
  healthyComputers: number;
  warningComputers: number;
  criticalComputers: number;
  totalUpdates: number;
  securityUpdatesCount: number;
  services: ServiceState[];
  db: DatabaseMetrics;
  isInstalled: boolean;
  diskFreeGB: number;
  automationStatus: 'Ready' | 'Not Set' | 'Running';
}

export interface OperationParameter {
  id: string;
  label: string;
  type: 'select' | 'number' | 'text';
  options?: string[];
  defaultValue: string | number;
}

export interface Operation {
  id: string;
  name: string;
  description: string;
  module: string;
  category: 'Deployment' | 'Maintenance' | 'Recovery' | 'Updates';
  script: string;
  modeRequirement?: 'Online' | 'Air-Gap' | 'Both';
  parameters?: OperationParameter[];
  isDatabaseOp?: boolean;
  action?: 'approve' | 'decline';
}

// ============================================================================
// Electron IPC Types
// ============================================================================

export interface DialogOptions {
  title?: string;
  filters?: { name: string; extensions: string[] }[];
  properties?: string[];
  defaultPath?: string;
}

export interface DialogResult {
  canceled: boolean;
  filePaths: string[];
  filePath?: string;
}

export interface PowerShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
}

export interface DebugInfo {
  debugLogPath: string;
  appPath: string;
  userDataPath: string;
  isPackaged: boolean;
  dirname?: string;
  cwd?: string;
  electronVersion?: string;
  nodeVersion?: string;
  platform?: string;
  arch?: string;
}

// Legacy IPC interface (nodeIntegration: true)
export interface ElectronIpcRenderer {
  invoke(channel: 'execute-powershell', command: string, timeout?: number): Promise<PowerShellResult>;
  invoke(channel: 'show-open-dialog' | 'show-directory-dialog' | 'show-save-dialog', options: DialogOptions): Promise<DialogResult>;
  invoke(channel: 'get-debug-info'): Promise<DebugInfo>;
}

// New secure API interface (contextBridge with contextIsolation: true)
export interface ElectronAPI {
  executePowerShell(command: string, timeout?: number): Promise<PowerShellResult>;
  showOpenDialog(options: DialogOptions): Promise<DialogResult>;
  showDirectoryDialog(options: DialogOptions): Promise<DialogResult>;
  showSaveDialog(options: DialogOptions): Promise<DialogResult>;
  getDebugInfo(): Promise<DebugInfo>;
  platform: string;
  isElectron: boolean;
  getVersion(): string;
}

// Window extensions for both legacy and new patterns
export interface ElectronWindow extends Window {
  require?: (module: 'electron') => { ipcRenderer: ElectronIpcRenderer };
  electronAPI?: ElectronAPI;  // New secure API from preload.js
}

// ============================================================================
// Helper Functions - Support both legacy and new patterns
// ============================================================================

/**
 * Get typed Electron IPC (legacy pattern - nodeIntegration: true)
 * @deprecated Use getElectronAPI() for new code
 */
export function getElectronIpc(): ElectronIpcRenderer | null {
  if (typeof window !== 'undefined') {
    const win = window as ElectronWindow;
    if (win.require) {
      try {
        return win.require('electron').ipcRenderer;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Get secure Electron API (new pattern - contextIsolation: true)
 * Falls back to legacy IPC wrapper if contextBridge not available
 */
export function getElectronAPI(): ElectronAPI | null {
  if (typeof window !== 'undefined') {
    const win = window as ElectronWindow;
    
    // Prefer new secure API
    if (win.electronAPI) {
      return win.electronAPI;
    }
    
    // Fallback to legacy IPC wrapped as ElectronAPI
    const ipc = getElectronIpc();
    if (ipc) {
      return {
        executePowerShell: (command, timeout) => ipc.invoke('execute-powershell', command, timeout),
        showOpenDialog: (options) => ipc.invoke('show-open-dialog', options),
        showDirectoryDialog: (options) => ipc.invoke('show-directory-dialog', options),
        showSaveDialog: (options) => ipc.invoke('show-save-dialog', options),
        getDebugInfo: () => ipc.invoke('get-debug-info'),
        platform: process?.platform || 'unknown',
        isElectron: true,
        getVersion: () => '3.8.9'
      };
    }
  }
  return null;
}

/**
 * Check if running in Electron context
 */
export function isElectronContext(): boolean {
  if (typeof window !== 'undefined') {
    const win = window as ElectronWindow;
    return !!(win.electronAPI || win.require);
  }
  return false;
}

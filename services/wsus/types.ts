/**
 * WSUS Service Types
 */

export interface SyncResult {
  success: boolean;
  message: string;
}

export interface SyncStatus {
  status: string;
  lastSyncTime: string;
  lastSyncResult: string;
  nextSyncTime: string;
}

export interface ComputerGroup {
  id: string;
  name: string;
  computerCount: number;
}

export interface PendingUpdate {
  id: string;
  title: string;
  classification: string;
  severity: string;
  releaseDate: string;
}

export interface ApprovalResult {
  approved: number;
  failed: number;
}

export interface DeclineResult {
  declined: number;
  failed?: number;
  errors?: number;
}

export interface GroupComputer {
  id: string;
  name: string;
  ipAddress: string;
  lastReported: string;
}

export interface HealthCheckResult {
  healthy: boolean;
  services: { name: string; status: string; healthy: boolean }[];
  database: { connected: boolean; sizeGB: number; lastBackup: string };
  sync: { lastSync: string; nextSync: string; status: string };
  issues: string[];
}

export interface ExportResult {
  success: boolean;
  exportedUpdates: number;
  sizeGB: number;
  errors: string[];
}

export interface ImportResult {
  success: boolean;
  importedUpdates: number;
  errors: string[];
}

export interface MaintenanceResult {
  supersededDeclined: number;
  oldDeclined: number;
  approved: number;
  cleanupSuccess: boolean;
}

export interface AutoApproveResult {
  approved: number;
  skipped: number;
  errors: number;
}

// Connection configuration
export interface WsusConnectionConfig {
  server: string;
  port: number;
  useSsl: boolean;
}

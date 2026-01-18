/**
 * WSUS Service - Modular Architecture
 * 
 * This module re-exports all WSUS operations and provides a unified WsusService class
 * for backward compatibility with existing code.
 */

// Re-export all types
export * from './types';

// Re-export all operations
export * from './connection';
export * from './sync';
export * from './groups';
export * from './updates';
export * from './computers';
export * from './maintenance';
export * from './airgap';

// Import for WsusService class
import { initialize, getConnectionScript } from './connection';
import { syncNow, getSyncStatus } from './sync';
import { getComputerGroups, getComputersInGroup, moveComputerToGroup } from './groups';
import {
  getPendingUpdates,
  approveUpdates,
  declineUpdates,
  declineSupersededUpdates,
  declineOldUpdates,
  declineDriverUpdates,
  autoApproveSecurityUpdates
} from './updates';
import { getComputers, getStats } from './computers';
import {
  performCleanup,
  configureProductsAndClassifications,
  performHealthCheck,
  runFullMaintenance
} from './maintenance';
import { exportToMedia, importFromMedia } from './airgap';

/**
 * WsusService class - Backward compatible wrapper
 * 
 * This class wraps all the modular functions for backward compatibility
 * with existing code that uses `wsusService.methodName()` pattern.
 */
class WsusService {
  // Connection
  initialize = initialize;
  
  // Sync
  syncNow = syncNow;
  getSyncStatus = getSyncStatus;
  
  // Groups
  getComputerGroups = getComputerGroups;
  getComputersInGroup = getComputersInGroup;
  moveComputerToGroup = moveComputerToGroup;
  
  // Updates
  getPendingUpdates = getPendingUpdates;
  approveUpdates = approveUpdates;
  declineUpdates = declineUpdates;
  declineSupersededUpdates = declineSupersededUpdates;
  declineOldUpdates = declineOldUpdates;
  declineDriverUpdates = declineDriverUpdates;
  autoApproveSecurityUpdates = autoApproveSecurityUpdates;
  
  // Computers
  getComputers = getComputers;
  getStats = getStats;
  
  // Maintenance
  performCleanup = performCleanup;
  configureProductsAndClassifications = configureProductsAndClassifications;
  performHealthCheck = performHealthCheck;
  runFullMaintenance = runFullMaintenance;
  
  // Air-gap
  exportToMedia = exportToMedia;
  importFromMedia = importFromMedia;
  
  // Internal helper (exposed for compatibility)
  private getConnectionScript = getConnectionScript;
}

// Export singleton instance for backward compatibility
export const wsusService = new WsusService();

/**
 * WSUS Connection Management
 */

import { powershellService } from '../powershellService';
import { loggingService } from '../loggingService';
import type { WsusConnectionConfig } from './types';

// Connection state
let connectionConfig: WsusConnectionConfig = {
  server: 'localhost',
  port: 8530,
  useSsl: false
};

/**
 * Get PowerShell script to connect to WSUS server
 */
export function getConnectionScript(): string {
  if (connectionConfig.server === 'localhost') {
    return `Get-WsusServer -Name localhost -PortNumber ${connectionConfig.port}`;
  }
  return `Get-WsusServer -Name "${connectionConfig.server}" -PortNumber ${connectionConfig.port} -UseSsl:$${connectionConfig.useSsl}`;
}

/**
 * Get current connection config
 */
export function getConnectionConfig(): WsusConnectionConfig {
  return { ...connectionConfig };
}

/**
 * Initialize WSUS connection
 */
export async function initialize(
  server: string = 'localhost',
  port: number = 8530,
  useSsl: boolean = false
): Promise<boolean> {
  connectionConfig = { server, port, useSsl };

  try {
    // Check if WSUS PowerShell module is available
    const moduleAvailable = await powershellService.checkModule('UpdateServices');

    if (!moduleAvailable) {
      loggingService.warn('WSUS PowerShell module (UpdateServices) not found.');
      loggingService.warn('This module is part of the WSUS Windows Server role.');
      loggingService.warn('To install: Add-WindowsFeature -Name UpdateServices -IncludeManagementTools');
      loggingService.info('Running in standalone mode without WSUS connection.');
      return false;
    }

    // Import the module
    const importResult = await powershellService.importModule('UpdateServices');
    if (!importResult.success) {
      loggingService.warn('Failed to import UpdateServices module. Running in standalone mode.');
      return false;
    }

    loggingService.info(`WSUS Service initialized: ${server}:${port} (SSL: ${useSsl})`);
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    loggingService.error(`Failed to initialize WSUS service: ${errorMessage}`);
    return false;
  }
}

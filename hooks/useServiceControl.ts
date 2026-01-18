import { useState, useCallback } from 'react';
import { loggingService } from '../services/loggingService';
import { toastService } from '../services/toastService';
import { getElectronIpc } from '../types';

interface ServiceControlResult {
  success: boolean;
  message: string;
}

// Map service display names to actual Windows service names
const SERVICE_NAME_MAP: Record<string, string> = {
  'WSUS Service': 'WsusService',
  'SQL Server (Express)': 'MSSQL$SQLEXPRESS',
  'SQL Server': 'MSSQLSERVER',
  'IIS (W3SVC)': 'W3SVC',
  'W3SVC': 'W3SVC',
  'WsusService': 'WsusService',
};

export function useServiceControl() {
  const [isControlling, setIsControlling] = useState<string | null>(null);

  const getActualServiceName = (displayName: string): string => {
    return SERVICE_NAME_MAP[displayName] || displayName;
  };

  const startService = useCallback(async (serviceName: string): Promise<ServiceControlResult> => {
    const actualName = getActualServiceName(serviceName);
    setIsControlling(serviceName);
    
    try {
      loggingService.info(`[SERVICE] Starting service: ${actualName}`);
      
      const ipc = getElectronIpc();
      if (ipc) {
        const script = `
          $ErrorActionPreference = 'Stop'
          try {
            $service = Get-Service -Name '${actualName}' -ErrorAction Stop
            if ($service.Status -eq 'Running') {
              Write-Output "ALREADY_RUNNING"
            } else {
              Start-Service -Name '${actualName}' -ErrorAction Stop
              Start-Sleep -Seconds 2
              $service = Get-Service -Name '${actualName}'
              if ($service.Status -eq 'Running') {
                Write-Output "SUCCESS"
              } else {
                Write-Output "FAILED:Service did not start"
              }
            }
          } catch {
            Write-Output "ERROR:$($_.Exception.Message)"
          }
        `;
        
        const result = await ipc.invoke('execute-powershell', script, 30000);
        
        if (result.stdout.includes('SUCCESS')) {
          loggingService.info(`[SERVICE] Successfully started ${actualName}`);
          toastService.success(`Service ${serviceName} started`);
          return { success: true, message: 'Service started successfully' };
        } else if (result.stdout.includes('ALREADY_RUNNING')) {
          loggingService.info(`[SERVICE] ${actualName} is already running`);
          toastService.info(`Service ${serviceName} is already running`);
          return { success: true, message: 'Service is already running' };
        } else {
          const errorMsg = result.stdout.replace('ERROR:', '').replace('FAILED:', '') || result.stderr || 'Unknown error';
          loggingService.error(`[SERVICE] Failed to start ${actualName}: ${errorMsg}`);
          return { success: false, message: errorMsg };
        }
      } else {
        loggingService.error('[SERVICE] Not running in Electron context');
        return { success: false, message: 'Service control requires Electron' };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      loggingService.error(`[SERVICE] Error starting ${actualName}: ${errorMsg}`);
      return { success: false, message: errorMsg };
    } finally {
      setIsControlling(null);
    }
  }, []);

  const stopService = useCallback(async (serviceName: string): Promise<ServiceControlResult> => {
    const actualName = getActualServiceName(serviceName);
    setIsControlling(serviceName);
    
    try {
      loggingService.info(`[SERVICE] Stopping service: ${actualName}`);
      
      const ipc = getElectronIpc();
      if (ipc) {
        const script = `
          $ErrorActionPreference = 'Stop'
          try {
            $service = Get-Service -Name '${actualName}' -ErrorAction Stop
            if ($service.Status -eq 'Stopped') {
              Write-Output "ALREADY_STOPPED"
            } else {
              Stop-Service -Name '${actualName}' -Force -ErrorAction Stop
              Start-Sleep -Seconds 2
              $service = Get-Service -Name '${actualName}'
              if ($service.Status -eq 'Stopped') {
                Write-Output "SUCCESS"
              } else {
                Write-Output "FAILED:Service did not stop"
              }
            }
          } catch {
            Write-Output "ERROR:$($_.Exception.Message)"
          }
        `;
        
        const result = await ipc.invoke('execute-powershell', script, 30000);
        
        if (result.stdout.includes('SUCCESS')) {
          loggingService.info(`[SERVICE] Successfully stopped ${actualName}`);
          toastService.success(`Service ${serviceName} stopped`);
          return { success: true, message: 'Service stopped successfully' };
        } else if (result.stdout.includes('ALREADY_STOPPED')) {
          loggingService.info(`[SERVICE] ${actualName} is already stopped`);
          toastService.info(`Service ${serviceName} is already stopped`);
          return { success: true, message: 'Service is already stopped' };
        } else {
          const errorMsg = result.stdout.replace('ERROR:', '').replace('FAILED:', '') || result.stderr || 'Unknown error';
          loggingService.error(`[SERVICE] Failed to stop ${actualName}: ${errorMsg}`);
          return { success: false, message: errorMsg };
        }
      } else {
        loggingService.error('[SERVICE] Not running in Electron context');
        return { success: false, message: 'Service control requires Electron' };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      loggingService.error(`[SERVICE] Error stopping ${actualName}: ${errorMsg}`);
      return { success: false, message: errorMsg };
    } finally {
      setIsControlling(null);
    }
  }, []);

  const restartService = useCallback(async (serviceName: string): Promise<ServiceControlResult> => {
    const stopResult = await stopService(serviceName);
    if (!stopResult.success && !stopResult.message.includes('already stopped')) {
      return stopResult;
    }
    return await startService(serviceName);
  }, [startService, stopService]);

  return {
    startService,
    stopService,
    restartService,
    isControlling
  };
}

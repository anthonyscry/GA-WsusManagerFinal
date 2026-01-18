import { useState, useCallback } from 'react';
import { loggingService } from '../services/loggingService';
import { stateService } from '../services/stateService';
import { getElectronIpc } from '../types';

interface DiagnosticResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

/**
 * Custom hook for managing diagnostics workflow
 * Runs REAL system diagnostics using PowerShell
 * 
 * @returns Object with diagnostics state and run function
 */
export function useDiagnostics() {
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  const runDiagnostics = useCallback(async () => {
    setIsDiagnosing(true);
    loggingService.warn('[DIAG] Starting system diagnostics...');
    
    const results: DiagnosticResult[] = [];
    
    try {
      const ipc = getElectronIpc();
      if (ipc) {
        // 1. Check WSUS Service
        loggingService.info('[DIAG] Checking WSUS Service...');
        const wsusResult = await ipc.invoke('execute-powershell', 
          `$svc = Get-Service -Name WsusService -ErrorAction SilentlyContinue; if ($svc -and $svc.Status -eq 'Running') { 'RUNNING' } else { 'STOPPED' }`,
          10000
        );
        const wsusStatus = wsusResult.stdout.includes('RUNNING') ? 'pass' : 'fail';
        results.push({ name: 'WSUS Service', status: wsusStatus, message: wsusResult.stdout.includes('RUNNING') ? 'Running' : 'Not running' });
        loggingService.info(`[DIAG] WSUS Service: ${wsusStatus === 'pass' ? '✓ Running' : '✗ Not running'}`);
        
        // 2. Check SQL Server
        loggingService.info('[DIAG] Checking SQL Server...');
        const sqlResult = await ipc.invoke('execute-powershell',
          `$svc = Get-Service -Name 'MSSQL$SQLEXPRESS','MSSQLSERVER' -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Running' }; if ($svc) { 'RUNNING' } else { 'STOPPED' }`,
          10000
        );
        const sqlStatus = sqlResult.stdout.includes('RUNNING') ? 'pass' : 'fail';
        results.push({ name: 'SQL Server', status: sqlStatus, message: sqlResult.stdout.includes('RUNNING') ? 'Running' : 'Not running' });
        loggingService.info(`[DIAG] SQL Server: ${sqlStatus === 'pass' ? '✓ Running' : '✗ Not running'}`);
        
        // 3. Check IIS
        loggingService.info('[DIAG] Checking IIS (W3SVC)...');
        const iisResult = await ipc.invoke('execute-powershell',
          `$svc = Get-Service -Name W3SVC -ErrorAction SilentlyContinue; if ($svc -and $svc.Status -eq 'Running') { 'RUNNING' } else { 'STOPPED' }`,
          10000
        );
        const iisStatus = iisResult.stdout.includes('RUNNING') ? 'pass' : 'fail';
        results.push({ name: 'IIS (W3SVC)', status: iisStatus, message: iisResult.stdout.includes('RUNNING') ? 'Running' : 'Not running' });
        loggingService.info(`[DIAG] IIS: ${iisStatus === 'pass' ? '✓ Running' : '✗ Not running'}`);
        
        // 4. Check Disk Space
        loggingService.info('[DIAG] Checking disk space...');
        const diskResult = await ipc.invoke('execute-powershell',
          `$drive = Get-PSDrive C; [math]::Round($drive.Free / 1GB, 2)`,
          10000
        );
        const freeGB = parseFloat(diskResult.stdout) || 0;
        const diskStatus = freeGB > 10 ? 'pass' : freeGB > 5 ? 'warn' : 'fail';
        results.push({ name: 'Disk Space (C:)', status: diskStatus, message: `${freeGB} GB free` });
        loggingService.info(`[DIAG] Disk Space: ${freeGB} GB free ${diskStatus === 'pass' ? '✓' : diskStatus === 'warn' ? '⚠' : '✗'}`);
        
        // 5. Check WSUS Content Directory
        loggingService.info('[DIAG] Checking WSUS content directory...');
        const contentResult = await ipc.invoke('execute-powershell',
          `if (Test-Path 'C:\\WSUS') { $size = (Get-ChildItem 'C:\\WSUS' -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1GB; [math]::Round($size, 2) } else { 'NOTFOUND' }`,
          30000
        );
        if (contentResult.stdout.includes('NOTFOUND')) {
          results.push({ name: 'WSUS Content', status: 'warn', message: 'Directory not found' });
          loggingService.warn('[DIAG] WSUS Content: ⚠ Directory not found');
        } else {
          const contentGB = parseFloat(contentResult.stdout) || 0;
          results.push({ name: 'WSUS Content', status: 'pass', message: `${contentGB} GB` });
          loggingService.info(`[DIAG] WSUS Content: ${contentGB} GB ✓`);
        }
        
        // 6. Check Network Connectivity
        loggingService.info('[DIAG] Checking network connectivity...');
        const netResult = await ipc.invoke('execute-powershell',
          `Test-NetConnection -ComputerName localhost -Port 8530 -WarningAction SilentlyContinue | Select-Object -ExpandProperty TcpTestSucceeded`,
          15000
        );
        const netStatus = netResult.stdout.includes('True') ? 'pass' : 'fail';
        results.push({ name: 'WSUS Port 8530', status: netStatus, message: netResult.stdout.includes('True') ? 'Listening' : 'Not accessible' });
        loggingService.info(`[DIAG] WSUS Port 8530: ${netStatus === 'pass' ? '✓ Listening' : '✗ Not accessible'}`);
        
        // Summary
        const passed = results.filter(r => r.status === 'pass').length;
        const warned = results.filter(r => r.status === 'warn').length;
        const failed = results.filter(r => r.status === 'fail').length;
        
        loggingService.warn(`[DIAG] COMPLETE: ${passed} passed, ${warned} warnings, ${failed} failed`);
        
        if (failed === 0 && warned === 0) {
          loggingService.info('[DIAG] ✓ All systems healthy');
        } else if (failed > 0) {
          loggingService.error(`[DIAG] ✗ ${failed} critical issue(s) detected`);
        }
        
      } else {
        loggingService.error('[DIAG] Diagnostics require Electron context');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      loggingService.error(`[DIAG] Diagnostics failed: ${errorMessage}`);
    } finally {
      setIsDiagnosing(false);
      // Refresh telemetry after diagnostics
      stateService.refreshTelemetry().catch(err => {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        loggingService.error(`Failed to refresh telemetry: ${errorMessage}`);
      });
    }
  }, []);

  return {
    isDiagnosing,
    runDiagnostics
  };
}

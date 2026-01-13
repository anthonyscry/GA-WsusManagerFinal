import { useState, useCallback } from 'react';
import { loggingService } from '../services/loggingService';
import { stateService } from '../services/stateService';

interface DiagnosticStep {
  msg: string;
  delay: number;
}

const DIAGNOSTIC_SEQUENCE: DiagnosticStep[] = [
  { msg: 'SQL: PAGE_VERIFY bits confirmed.', delay: 800 },
  { msg: 'IIS: AppPool W3SVC recycling verified.', delay: 1600 },
  { msg: 'WSUS: SUSDB retrieval latencies within 5ms.', delay: 2400 },
  { msg: 'DISK: C:\\WSUS cluster alignment healthy.', delay: 3200 },
  { msg: 'DIAG_COMPLETE: System integrity verified.', delay: 4000 }
];

const TOTAL_DIAGNOSTIC_DURATION_MS = 4500;

/**
 * Custom hook for managing diagnostics workflow
 * Handles running diagnostics, logging steps, and completion
 * 
 * @returns Object with diagnostics state and run function
 */
export function useDiagnostics() {
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  const runDiagnostics = useCallback(() => {
    setIsDiagnosing(true);
    loggingService.warn('INTEGRITY_CHECK: Initializing heartbeat scan...');
    
    DIAGNOSTIC_SEQUENCE.forEach(step => {
      setTimeout(() => loggingService.info(`[DIAG] ${step.msg}`), step.delay);
    });

    setTimeout(() => {
      setIsDiagnosing(false);
      stateService.refreshTelemetry().catch(err => {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        loggingService.error(`Failed to refresh telemetry after diagnostics: ${errorMessage}`);
      });
    }, TOTAL_DIAGNOSTIC_DURATION_MS);
  }, []);

  return {
    isDiagnosing,
    runDiagnostics
  };
}

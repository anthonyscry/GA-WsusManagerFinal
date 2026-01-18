
import { LogEntry, LogLevel, getElectronIpc } from '../types';
import { toastService } from './toastService';

const STORAGE_KEY = 'wsus_pro_logs';
const MAX_LOGS = 200;
const MAX_MESSAGE_LENGTH = 10000;

// Track recent error messages to avoid duplicate toasts
const recentErrorMessages = new Set<string>();
const ERROR_DEDUP_TIMEOUT_MS = 5000;

/**
 * Sanitize log message to prevent XSS and limit length
 */
function sanitizeMessage(message: string): string {
  return message
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .substring(0, MAX_MESSAGE_LENGTH);
}

/**
 * Generate secure random ID
 */
function generateSecureId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(36)).join('').slice(0, 11);
}

class LoggingService {
  private logs: LogEntry[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.logs = Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      console.error('Failed to load logs', e);
      this.logs = [];
    }
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs.slice(-MAX_LOGS)));
    } catch (e) {
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        // Clear old logs and retry
        this.logs = this.logs.slice(-Math.floor(MAX_LOGS / 2));
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs));
        } catch (retryError) {
          console.error('Failed to persist logs after cleanup', retryError);
        }
      } else {
        console.error('Failed to persist logs', e);
      }
    }
  }

  private log(level: LogLevel, message: string, context?: unknown) {
    // Sanitize message
    const sanitizedMessage = sanitizeMessage(message);
    
    const entry: LogEntry = {
      id: generateSecureId(),
      timestamp: new Date().toISOString(),
      level,
      message: sanitizedMessage,
      context: context ? JSON.parse(JSON.stringify(context)) : undefined  // Deep clone to prevent reference issues
    };
    
    this.logs.push(entry);
    this.persist();
    
    // Dispatch event for UI updates if active
    try {
      window.dispatchEvent(new CustomEvent('wsus_log_added', { detail: entry }));
    } catch (error) {
      // Event dispatch might fail in some contexts
      console.warn('Failed to dispatch log event', error);
    }
    
    if (level === LogLevel.ERROR) {
      console.error(`[WSUS ${level}] ${sanitizedMessage}`, context);
      
      // Show toast for errors (with deduplication)
      if (!recentErrorMessages.has(sanitizedMessage)) {
        recentErrorMessages.add(sanitizedMessage);
        setTimeout(() => recentErrorMessages.delete(sanitizedMessage), ERROR_DEDUP_TIMEOUT_MS);
        
        // Truncate message for toast display
        const toastMessage = sanitizedMessage.length > 100 
          ? sanitizedMessage.substring(0, 100) + '...' 
          : sanitizedMessage;
        toastService.error(toastMessage);
      }
    }
  }

  info(message: string, context?: unknown) {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: unknown) {
    this.log(LogLevel.WARNING, message, context);
  }

  error(message: string, context?: unknown) {
    this.log(LogLevel.ERROR, message, context);
  }

  getLogs(): LogEntry[] {
    return [...this.logs].reverse();
  }

  clearLogs() {
    this.logs = [];
    try {
      localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('wsus_log_cleared'));
    } catch (error) {
      console.error('Failed to clear logs', error);
    }
  }

  /**
   * Export logs to a file
   */
  async exportLogs(format: 'txt' | 'json' | 'csv' = 'txt'): Promise<boolean> {
    try {
      const logs = this.getLogs().reverse(); // Chronological order
      let content: string;
      let filename: string;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

      if (format === 'json') {
        content = JSON.stringify(logs, null, 2);
        filename = `wsus_logs_${timestamp}.json`;
      } else if (format === 'csv') {
        const csvHeader = 'Timestamp,Level,Message\n';
        const csvRows = logs.map(log => 
          `"${log.timestamp}","${log.level}","${log.message.replace(/"/g, '""')}"`
        ).join('\n');
        content = csvHeader + csvRows;
        filename = `wsus_logs_${timestamp}.csv`;
      } else {
        // txt (default)
        content = logs.map(log => 
          `[${log.timestamp}] [${log.level}] ${log.message}`
        ).join('\n');
        filename = `wsus_logs_${timestamp}.txt`;
      }

      // Check if we're in Electron context
      const ipc = getElectronIpc();
      if (ipc) {
        // Show save dialog
        const result = await ipc.invoke('show-save-dialog', {
          title: 'Export Logs',
          defaultPath: filename,
          filters: [
            { name: format.toUpperCase(), extensions: [format] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });

        if (!result.canceled && result.filePath) {
          // Write file using PowerShell
          const escapedContent = content.replace(/`/g, '``').replace(/\$/g, '`$').replace(/"/g, '`"');
          const escapedPath = result.filePath.replace(/\\/g, '\\\\');
          
          const script = `
            $content = @"
${escapedContent}
"@
            $content | Out-File -FilePath "${escapedPath}" -Encoding UTF8
            Write-Output "SUCCESS"
          `;
          
          const writeResult = await ipc.invoke('execute-powershell', script, 30000);
          
          if (writeResult.stdout.includes('SUCCESS')) {
            this.info(`[EXPORT] Logs exported to ${result.filePath}`);
            return true;
          }
        }
      } else {
        // Browser fallback - download via blob
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.info(`[EXPORT] Logs downloaded as ${filename}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to export logs', error);
      return false;
    }
  }
}

export const loggingService = new LoggingService();

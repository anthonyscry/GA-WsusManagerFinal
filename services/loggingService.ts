
import { LogEntry, LogLevel } from '../types';

const STORAGE_KEY = 'wsus_pro_logs';
const MAX_LOGS = 200;
const MAX_MESSAGE_LENGTH = 10000;

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
}

export const loggingService = new LoggingService();

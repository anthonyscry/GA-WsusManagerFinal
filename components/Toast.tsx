import React, { useEffect, useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  title?: string;
}

// Friendly error messages for common errors
export const friendlyErrorMessages: Record<string, string> = {
  'WSUS service not running': 'The WSUS service appears to be stopped. Please start the WSUS service and try again.',
  'SQL Server connection failed': 'Unable to connect to SQL Server. Please verify the service is running and credentials are correct.',
  'Network timeout': 'The operation took too long to complete. Please check your network connection and try again.',
  'Permission denied': 'You don\'t have permission to perform this action. Please run as administrator.',
  'PowerShell execution failed': 'The PowerShell command failed to execute. Please check the logs for details.',
  'Command not whitelisted': 'This command is not allowed for security reasons.',
  'Database operation failed': 'The database operation failed. Please check the SQL Server connection.',
  'ECONNREFUSED': 'Connection refused. Please verify the target service is running.',
  'ETIMEDOUT': 'Connection timed out. Please check the network connectivity.',
  'not available in browser': 'This feature requires the desktop application. Please run GA-WsusManager Pro as a standalone app.',
  'default': 'An unexpected error occurred. Please check the logs for more details.',
};

export function getFriendlyError(error: string | Error): string {
  const errorStr = error instanceof Error ? error.message : error;
  for (const [key, message] of Object.entries(friendlyErrorMessages)) {
    if (key !== 'default' && errorStr.toLowerCase().includes(key.toLowerCase())) {
      return message;
    }
  }
  return friendlyErrorMessages['default'];
}

interface ToastProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const ToastComponent: React.FC<ToastProps> = ({ toast, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, toast.duration || 5000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  const typeStyles = {
    success: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400',
    error: 'bg-rose-500/20 border-rose-500/40 text-rose-400',
    warning: 'bg-amber-500/20 border-amber-500/40 text-amber-400',
    info: 'bg-blue-500/20 border-blue-500/40 text-blue-400'
  };

  const icons = {
    success: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  };

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm shadow-xl
        ${typeStyles[toast.type]}
        animate-slideInRight
        min-w-[300px] max-w-[500px]
      `}
      role="alert"
      aria-live="polite"
    >
      <div className="flex-shrink-0">
        {icons[toast.type]}
      </div>
      <p className="flex-1 text-sm font-semibold">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="flex-shrink-0 text-slate-400 hover:text-white transition-colors p-1"
        aria-label="Close notification"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-20 right-8 z-[200] flex flex-col gap-3 pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastComponent toast={toast} onRemove={onRemove} />
        </div>
      ))}
    </div>
  );
};

/**
 * Custom hook for managing toast notifications
 */
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback((message: string, duration?: number) => {
    return addToast({ type: 'success', message, duration });
  }, [addToast]);

  const error = useCallback((message: string, duration?: number) => {
    // Use friendly error message if available
    const friendlyMessage = getFriendlyError(message);
    return addToast({ type: 'error', message: friendlyMessage, duration: duration || 8000 });
  }, [addToast]);

  const warning = useCallback((message: string, duration?: number) => {
    return addToast({ type: 'warning', message, duration });
  }, [addToast]);

  const info = useCallback((message: string, duration?: number) => {
    return addToast({ type: 'info', message, duration });
  }, [addToast]);

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
  };
}

export default ToastComponent;

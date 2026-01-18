/**
 * Global Toast Service
 * Allows showing toast notifications from anywhere in the app
 * Uses custom events to communicate with React components
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastEvent {
  message: string;
  type: ToastType;
  duration?: number;
}

let toastIdCounter = 0;

/**
 * Show a toast notification
 */
function showToast(message: string, type: ToastType = 'info', duration?: number): void {
  const event = new CustomEvent('wsus_toast', {
    detail: {
      id: `toast-${++toastIdCounter}`,
      message,
      type,
      duration
    }
  });
  window.dispatchEvent(event);
}

/**
 * Show a success toast
 */
function success(message: string, duration?: number): void {
  showToast(message, 'success', duration);
}

/**
 * Show an error toast
 */
function error(message: string, duration?: number): void {
  showToast(message, 'error', duration || 7000); // Errors stay longer
}

/**
 * Show a warning toast
 */
function warning(message: string, duration?: number): void {
  showToast(message, 'warning', duration);
}

/**
 * Show an info toast
 */
function info(message: string, duration?: number): void {
  showToast(message, 'info', duration);
}

export const toastService = {
  show: showToast,
  success,
  error,
  warning,
  info
};

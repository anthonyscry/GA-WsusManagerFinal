/**
 * Internet connectivity checker
 * Automatically detects if the app has internet connection
 */

const CONNECTIVITY_CHECK_INTERVAL_MS = 30000; // Check every 30 seconds
const CONNECTIVITY_CHECK_TIMEOUT_MS = 5000; // 5 second timeout
const CONNECTIVITY_CHECK_URLS = [
  'https://www.google.com/favicon.ico',
  'https://www.microsoft.com/favicon.ico',
  'https://1.1.1.1' // Cloudflare DNS
];

let connectivityCheckInterval: NodeJS.Timeout | null = null;
let lastKnownStatus: boolean = true;
const connectivityListeners: Set<(isOnline: boolean) => void> = new Set();

/**
 * Check if internet connection is available
 */
async function checkConnectivity(): Promise<boolean> {
  // First check navigator.onLine (browser API)
  if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
    if (!navigator.onLine) {
      return false;
    }
  }

  // Then try to fetch from reliable sources
  for (const url of CONNECTIVITY_CHECK_URLS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONNECTIVITY_CHECK_TIMEOUT_MS);
      
      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
        cache: 'no-cache'
      });
      
      clearTimeout(timeoutId);
      
      // If we get here, we have connectivity
      return true;
    } catch (error) {
      // Continue to next URL
      continue;
    }
  }

  // If all checks failed, assume offline
  return false;
}

/**
 * Start periodic connectivity checking
 */
export function startConnectivityMonitoring(
  onStatusChange: (isOnline: boolean) => void
): void {
  // Add listener
  connectivityListeners.add(onStatusChange);

  // Initial check
  checkConnectivity().then(isOnline => {
    lastKnownStatus = isOnline;
    notifyListeners(isOnline);
  });

  // Set up periodic checking
  if (!connectivityCheckInterval) {
    connectivityCheckInterval = setInterval(async () => {
      const isOnline = await checkConnectivity();
      if (isOnline !== lastKnownStatus) {
        lastKnownStatus = isOnline;
        notifyListeners(isOnline);
      }
    }, CONNECTIVITY_CHECK_INTERVAL_MS);
  }

  // Also listen to browser online/offline events
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      checkConnectivity().then(isOnline => {
        if (isOnline !== lastKnownStatus) {
          lastKnownStatus = isOnline;
          notifyListeners(isOnline);
        }
      });
    });

    window.addEventListener('offline', () => {
      lastKnownStatus = false;
      notifyListeners(false);
    });
  }
}

/**
 * Stop connectivity monitoring
 */
export function stopConnectivityMonitoring(
  onStatusChange: (isOnline: boolean) => void
): void {
  connectivityListeners.delete(onStatusChange);

  if (connectivityListeners.size === 0 && connectivityCheckInterval) {
    clearInterval(connectivityCheckInterval);
    connectivityCheckInterval = null;
  }
}

/**
 * Notify all listeners of connectivity status change
 */
function notifyListeners(isOnline: boolean): void {
  connectivityListeners.forEach(listener => {
    try {
      listener(isOnline);
    } catch (error) {
      console.error('Connectivity listener error:', error);
    }
  });
}

/**
 * Get current connectivity status (synchronous, may be stale)
 */
export function getConnectivityStatus(): boolean {
  if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
    return navigator.onLine;
  }
  return lastKnownStatus;
}

/**
 * Check connectivity once (async)
 */
export async function checkConnectivityOnce(): Promise<boolean> {
  return await checkConnectivity();
}

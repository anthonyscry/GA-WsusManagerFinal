/**
 * Connectivity checker for WSUS environment
 * Checks if the app has internet connectivity for WSUS DB sync operations
 * 
 * NOTE: This checks internet connectivity for WSUS sync, not local WSUS server reachability.
 * Air-gap mode = No internet (WSUS can't sync with Microsoft Update servers)
 * Cloud-sync mode = Has internet (WSUS can sync with Microsoft Update servers)
 */

const CONNECTIVITY_CHECK_INTERVAL_MS = 30000; // Check every 30 seconds

let connectivityCheckInterval: NodeJS.Timeout | null = null;
let lastKnownStatus: boolean = true;
const connectivityListeners: Set<(isOnline: boolean) => void> = new Set();

/**
 * Check if internet connectivity is available for WSUS sync
 * Uses navigator.onLine API - works offline without external requests
 * This determines if WSUS can sync with Microsoft Update servers
 */
async function checkConnectivity(): Promise<boolean> {
  // Use navigator.onLine API to check basic network/internet availability
  // This is sufficient for determining if WSUS can sync with external sources
  if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
    return navigator.onLine;
  }

  // Fallback: assume online if navigator not available (shouldn't happen in Electron)
  return true;
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

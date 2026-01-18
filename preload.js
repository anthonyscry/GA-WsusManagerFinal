/**
 * Electron Preload Script - Secure Bridge between Main and Renderer
 * 
 * This script runs in a privileged context and exposes a controlled API
 * to the renderer process via contextBridge.
 * 
 * SECURITY: Only expose what's absolutely necessary. Never expose raw ipcRenderer.
 */

const { contextBridge, ipcRenderer } = require('electron');

// ============================================================================
// SECURE API EXPOSURE via contextBridge
// ============================================================================

contextBridge.exposeInMainWorld('electronAPI', {
  // -------------------------------------------------------------------------
  // PowerShell Execution (validated server-side in main.js)
  // -------------------------------------------------------------------------
  executePowerShell: (command, timeout = 30000) => {
    // Basic client-side validation (server-side is authoritative)
    if (typeof command !== 'string' || command.length === 0) {
      return Promise.resolve({
        stdout: '',
        stderr: 'Invalid command',
        exitCode: 1,
        success: false
      });
    }
    return ipcRenderer.invoke('execute-powershell', command, timeout);
  },

  // -------------------------------------------------------------------------
  // Dialog APIs
  // -------------------------------------------------------------------------
  showOpenDialog: (options) => {
    return ipcRenderer.invoke('show-open-dialog', options);
  },

  showDirectoryDialog: (options) => {
    return ipcRenderer.invoke('show-directory-dialog', options);
  },

  showSaveDialog: (options) => {
    return ipcRenderer.invoke('show-save-dialog', options);
  },

  // -------------------------------------------------------------------------
  // Debug/Info APIs
  // -------------------------------------------------------------------------
  getDebugInfo: () => {
    return ipcRenderer.invoke('get-debug-info');
  },

  // -------------------------------------------------------------------------
  // Platform Info (read-only, no IPC needed)
  // -------------------------------------------------------------------------
  platform: process.platform,
  isElectron: true,

  // -------------------------------------------------------------------------
  // App Version (can be populated from package.json if needed)
  // -------------------------------------------------------------------------
  getVersion: () => {
    // This could be enhanced to get from main process
    return '3.8.9';
  }
});

// Log preload script initialization
console.log('[Preload] Electron API exposed via contextBridge');

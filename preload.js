/**
 * Preload script for Electron
 * Provides secure IPC bridge between renderer and main process
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // PowerShell execution (if needed)
  executePowerShell: (command) => ipcRenderer.invoke('execute-powershell', command),
  
  // Add other secure APIs as needed
  platform: process.platform,
  versions: process.versions
});

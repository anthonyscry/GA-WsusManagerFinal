const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Store reference to main window
let mainWindow = null;

// IPC handler for PowerShell execution (secure alternative)
ipcMain.handle('execute-powershell', async (event, command, timeout = 30000) => {
  // Check if sender window is still valid
  if (!event.sender || event.sender.isDestroyed()) {
    return {
      stdout: '',
      stderr: 'Window has been destroyed',
      exitCode: 1,
      success: false
    };
  }

  try {
    const psCommand = `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${command.replace(/"/g, '\\"')}"`;
    const { stdout, stderr } = await execAsync(psCommand, {
      timeout,
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });
    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: 0,
      success: true
    };
  } catch (error) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || error.message || '',
      exitCode: error.code || 1,
      success: false
    };
  }
});

function createWindow() {
  // Close existing window if any
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }

  const iconPath = path.join(__dirname, 'build', 'icon.png');
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    backgroundColor: '#0a0a0c',
    title: 'GA-WsusManager Pro | Portable Hub',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      // Balanced security: Allow nodeIntegration for system access but keep contextIsolation
      // This is acceptable for a desktop app that needs system-level access
      nodeIntegration: true,
      contextIsolation: false,  // Required for direct Node.js access in this architecture
      // Note: For production, consider migrating to IPC-based architecture
      // For now, this maintains functionality while being aware of security implications
    },
    autoHideMenuBar: true,
    show: false
  });

  // Check if we're in development or production
  const isDev = !app.isPackaged;
  
  if (isDev) {
    // Development: load from Vite dev server
    mainWindow.loadURL('http://localhost:3000').catch(() => {
      // Handle navigation errors silently
    });
    mainWindow.webContents.openDevTools();
  } else {
    // Production: load from dist folder
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    if (fs.existsSync(indexPath)) {
      mainWindow.loadFile(indexPath).catch(() => {
        // Handle navigation errors silently
      });
    } else {
      console.error('Index file not found at:', indexPath);
    }
  }

  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  });

  // Clean up reference when window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  // Clear window reference
  mainWindow = null;
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', (event) => {
  // Prevent default quit behavior to allow cleanup
  // The app will quit after this handler completes
});

app.on('will-quit', (event) => {
  // Final cleanup before quit
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.removeAllListeners();
  }
  mainWindow = null;
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

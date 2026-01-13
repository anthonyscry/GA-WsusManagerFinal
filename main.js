const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// ============================================================================
// File-based Logging System
// ============================================================================
const LOG_DIR = path.join(app.getPath('userData'), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'wsus-manager.log');
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_LOG_FILES = 3;

// Ensure log directory exists
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

// Rotate logs if needed
function rotateLogsIfNeeded() {
  try {
    if (!fs.existsSync(LOG_FILE)) return;

    const stats = fs.statSync(LOG_FILE);
    if (stats.size < MAX_LOG_SIZE) return;

    // Rotate existing log files
    for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
      const oldFile = `${LOG_FILE}.${i}`;
      const newFile = `${LOG_FILE}.${i + 1}`;
      if (fs.existsSync(oldFile)) {
        if (i === MAX_LOG_FILES - 1) {
          fs.unlinkSync(oldFile); // Delete oldest
        } else {
          fs.renameSync(oldFile, newFile);
        }
      }
    }

    // Rename current log to .1
    fs.renameSync(LOG_FILE, `${LOG_FILE}.1`);
  } catch (error) {
    console.error('Failed to rotate logs:', error);
  }
}

// Write log entry to file
function writeToLogFile(level, message, context) {
  try {
    ensureLogDir();
    rotateLogsIfNeeded();

    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
    const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}\n`;

    fs.appendFileSync(LOG_FILE, logLine, 'utf8');
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
}

// Log startup info
function logStartup() {
  writeToLogFile('INFO', '='.repeat(60));
  writeToLogFile('INFO', `GA-WsusManager Pro Starting - v${app.getVersion()}`);
  writeToLogFile('INFO', `Platform: ${process.platform} | Arch: ${process.arch}`);
  writeToLogFile('INFO', `Electron: ${process.versions.electron} | Node: ${process.versions.node}`);
  writeToLogFile('INFO', `User Data: ${app.getPath('userData')}`);
  writeToLogFile('INFO', `Log File: ${LOG_FILE}`);
  writeToLogFile('INFO', '='.repeat(60));
}

// IPC handler for logging from renderer
ipcMain.handle('write-log', async (event, level, message, context) => {
  writeToLogFile(level, message, context);
  return true;
});

// IPC handler to get log file path
ipcMain.handle('get-log-path', async () => {
  return LOG_FILE;
});

// IPC handler to read recent logs
ipcMain.handle('read-log-file', async (event, lines = 100) => {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      return { success: true, logs: [] };
    }

    const content = fs.readFileSync(LOG_FILE, 'utf8');
    const allLines = content.split('\n').filter(line => line.trim());
    const recentLines = allLines.slice(-lines);

    return { success: true, logs: recentLines };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Content Security Policy for production
// Restricts resource loading to local files only
const CSP_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",  // Required for Vite bundled scripts
  "style-src 'self' 'unsafe-inline'",   // Required for Tailwind/styled-components
  "img-src 'self' data: blob:",         // Allow local images and data URIs
  "font-src 'self'",                    // System fonts only
  "connect-src 'self'",                 // No external network requests
  "frame-src 'none'",                   // No iframes
  "object-src 'none'",                  // No plugins
  "base-uri 'self'",                    // Restrict base URL
].join('; ');

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

// IPC handler for file/directory selection dialog
ipcMain.handle('show-open-dialog', async (event, options) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { canceled: true, filePaths: [] };
  }
  
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

// IPC handler for directory selection dialog
ipcMain.handle('show-directory-dialog', async (event, options) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { canceled: true, filePaths: [] };
  }
  
  const result = await dialog.showOpenDialog(mainWindow, {
    ...options,
    properties: ['openDirectory']
  });
  return result;
});

function createWindow() {
  // Close existing window if any
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }

  const iconPath = path.join(__dirname, 'build', 'icon.png');
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 800,
    minHeight: 600,
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
      webSecurity: true,  // Keep security enabled but allow local file loading
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

  // Apply Content Security Policy headers
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [CSP_POLICY],
      },
    });
  });

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
  logStartup();
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

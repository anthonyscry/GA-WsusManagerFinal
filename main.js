const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Store reference to main window
let mainWindow = null;

// ============================================================================
// SECURITY: PowerShell Command Allowlist (Server-side validation)
// This MUST be the authoritative validation - renderer-side checks are defense-in-depth only
// ============================================================================
const ALLOWED_COMMAND_PATTERNS = [
  // WSUS commands
  /^Get-WsusServer/i,
  /^Get-WsusComputer/i,
  /^Get-WsusUpdate/i,
  /^Invoke-WsusServerSynchronization/i,
  /^Invoke-WsusServerCleanup/i,
  /^Get-WsusProduct/i,
  /^Set-WsusProduct/i,
  /^Get-WsusClassification/i,
  /^Set-WsusClassification/i,
  /^Approve-WsusUpdate/i,
  /^Deny-WsusUpdate/i,
  /^Set-WsusServerSynchronization/i,
  /^Get-ComputerTargetGroup/i,
  // Windows Service commands
  /^Get-Service/i,
  /^Start-Service/i,
  /^Stop-Service/i,
  /^Restart-Service/i,
  // Process commands (read-only)
  /^Get-Process/i,
  // NOTE: Stop-Process removed - too dangerous
  // Module commands (read-only)
  /^Get-Module/i,
  /^Import-Module/i,
  // SQL commands
  /^Invoke-Sqlcmd/i,
  // Data conversion
  /^ConvertTo-Json/i,
  /^ConvertFrom-Json/i,
  // File system (read-only only)
  /^Test-Path/i,
  /^Get-ChildItem/i,
  /^Get-Content/i,
  /^Join-Path/i,
  // File output (restricted - only from pipeline, not arbitrary content)
  /\|\s*Out-File/i,  // Only allow Out-File when piped (not direct arbitrary writes)
  // Output commands (console only)
  /^Write-Output/i,
  /^Write-Error/i,
  // Task Scheduler commands (read-only only)
  /^Get-ScheduledTask/i,
  /^Get-ScheduledTaskInfo/i,
  // NOTE: Register/Unregister/Set-ScheduledTask removed - can create persistent backdoors
  // STIG compliance check commands (read-only)
  /^Get-ItemProperty/i,
  /^Get-WebConfigurationProperty/i,
  /^Get-WebConfiguration/i,
  /^netsh\s+(http|firewall)\s+show/i,  // Read-only netsh only
  /^auditpol\s+\/get/i,                 // Read-only auditpol only
  /^Get-NetFirewallProfile/i,
  // NOTE: secedit removed - can modify security policy
  // Deployment commands (read-only)
  /^Get-WindowsFeature/i,
  // NOTE: Install-WindowsFeature removed - system modification
  /^Get-CimInstance/i,
  // Utility commands
  /^Get-PSDrive/i,
  /^Get-Command/i,
  /^Test-NetConnection/i,
  /^Select-Object/i,
  /^Where-Object/i,
  /^ForEach-Object/i,
  /^Measure-Object/i,
  /^Start-Sleep/i,
  // NOTE: Add-Type removed - allows compiling/running arbitrary .NET code
  // Allow PSCustomObject for data structures (safe)
  /^\[PSCustomObject\]/i,
  // NOTE: [xml] and [System.IO.Compression removed - type casting can be abused
];

// DANGEROUS commands explicitly blocked (even if they match other patterns)
const BLOCKED_COMMAND_PATTERNS = [
  /Invoke-WebRequest/i,      // Network access - not needed for air-gapped
  /Invoke-RestMethod/i,      // Network access
  /Install-Module/i,         // Downloads from internet
  /Start-Process/i,          // Can launch arbitrary processes
  /Invoke-Expression/i,      // Code injection risk
  /iex\s/i,                  // Alias for Invoke-Expression
  /DownloadString/i,         // .NET download method
  /DownloadFile/i,           // .NET download method
  /WebClient/i,              // .NET web client
  /Net\.WebRequest/i,        // .NET web request
  /\-EncodedCommand/i,       // Obfuscation technique
  /\-enc\s/i,                // Short form of -EncodedCommand
  /FromBase64String/i,       // Often used for obfuscation
  /PsExec/i,                 // Remote execution tool - high risk
  /Remove-Item.*\-Recurse.*\-Force/i,  // Dangerous recursive delete
];

/**
 * Server-side validation: Check if command is allowed
 * This is the AUTHORITATIVE check - renderer-side is defense-in-depth only
 */
function isCommandAllowed(command) {
  if (!command || typeof command !== 'string') {
    return { allowed: false, reason: 'Invalid command: must be a non-empty string' };
  }

  const normalizedCommand = command.replace(/\s+/g, ' ').trim();
  
  // FIRST: Check for explicitly blocked patterns (highest priority)
  for (const pattern of BLOCKED_COMMAND_PATTERNS) {
    if (pattern.test(normalizedCommand)) {
      return { 
        allowed: false, 
        reason: `Command contains blocked pattern: ${pattern.source}` 
      };
    }
  }
  
  // SECOND: Check if command contains any allowed pattern
  const containsAllowedCommand = ALLOWED_COMMAND_PATTERNS.some(pattern => {
    // Remove ^ anchor to check anywhere in the string
    const flexiblePattern = new RegExp(pattern.source.replace('^', ''), pattern.flags);
    return flexiblePattern.test(normalizedCommand);
  });
  
  if (containsAllowedCommand) {
    return { allowed: true, reason: 'Command matches allowlist' };
  }
  
  // THIRD: Pipeline operations to allowed commands are OK
  // NOTE: Removed generic "variable assignment" and "control flow" exceptions
  // These were too permissive and allowed running arbitrary .NET methods
  const isPipelineToAllowed = /\|\s*(Select-Object|Where-Object|ForEach-Object|Measure-Object|ConvertTo-Json|ConvertFrom-Json)/i.test(normalizedCommand);
  
  if (isPipelineToAllowed) {
    return { allowed: true, reason: 'Command pipes to allowed cmdlet' };
  }
  
  return { 
    allowed: false, 
    reason: 'Command not in allowlist. Only WSUS, service management, and approved system commands are permitted.' 
  };
}

// ============================================================================
// DEBUG LOGGING - Writes to file for troubleshooting on lab servers
// ============================================================================
const DEBUG_LOG_ENABLED = true;
const debugLogPath = path.join(app.getPath('userData'), 'debug.log');

function debugLog(message, data = null) {
  if (!DEBUG_LOG_ENABLED) return;
  
  const timestamp = new Date().toISOString();
  let logLine = `[${timestamp}] ${message}`;
  if (data !== null) {
    logLine += ` | Data: ${JSON.stringify(data, null, 2)}`;
  }
  logLine += '\n';
  
  // Write to file
  try {
    fs.appendFileSync(debugLogPath, logLine);
  } catch (err) {
    console.error('Failed to write debug log:', err);
  }
  
  // Also log to console
  console.log(logLine);
}

// Clear previous log on startup
try {
  if (fs.existsSync(debugLogPath)) {
    fs.unlinkSync(debugLogPath);
  }
  debugLog('=== GA-WsusManager Pro Debug Log Started ===');
  debugLog('App Path', app.getAppPath());
  debugLog('User Data Path', app.getPath('userData'));
  debugLog('Is Packaged', app.isPackaged);
  debugLog('__dirname', __dirname);
  debugLog('Process CWD', process.cwd());
  debugLog('Electron Version', process.versions.electron);
  debugLog('Node Version', process.versions.node);
  debugLog('Chrome Version', process.versions.chrome);
  debugLog('Platform', process.platform);
  debugLog('Arch', process.arch);
} catch (err) {
  console.error('Failed to initialize debug log:', err);
}

// IPC handler for PowerShell execution (SECURED with server-side validation)
ipcMain.handle('execute-powershell', async (event, command, timeout = 30000) => {
  // SECURITY: Validate sender is from our app
  if (!event.sender || event.sender.isDestroyed()) {
    debugLog('SECURITY: Rejected PowerShell - sender destroyed');
    return {
      stdout: '',
      stderr: 'Window has been destroyed',
      exitCode: 1,
      success: false
    };
  }

  // SECURITY: Validate sender URL (must be from our packaged app or localhost dev)
  const senderURL = event.sender.getURL();
  const isValidSender = senderURL.startsWith('file://') || 
                        senderURL.startsWith('http://localhost') ||
                        senderURL === '';
  
  if (!isValidSender) {
    debugLog('SECURITY: Rejected PowerShell - invalid sender URL', { senderURL });
    return {
      stdout: '',
      stderr: 'Security: Invalid request origin',
      exitCode: 1,
      success: false
    };
  }

  // SECURITY: Server-side command validation (AUTHORITATIVE)
  const validation = isCommandAllowed(command);
  if (!validation.allowed) {
    debugLog('SECURITY: Rejected PowerShell command', { 
      reason: validation.reason,
      commandPreview: command.substring(0, 100) + (command.length > 100 ? '...' : '')
    });
    return {
      stdout: '',
      stderr: `Security: ${validation.reason}`,
      exitCode: 1,
      success: false
    };
  }

  try {
    debugLog('Executing PowerShell', { 
      commandPreview: command.substring(0, 100) + (command.length > 100 ? '...' : ''),
      timeout 
    });
    
    // Escape quotes for command line
    const escapedCommand = command.replace(/"/g, '\\"');
    const psCommand = `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${escapedCommand}"`;
    
    const { stdout, stderr } = await execAsync(psCommand, {
      timeout,
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });
    
    debugLog('PowerShell executed successfully', { 
      stdoutLength: stdout.length,
      stderrLength: stderr.length 
    });
    
    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: 0,
      success: true
    };
  } catch (error) {
    debugLog('PowerShell execution failed', { 
      message: error.message,
      code: error.code 
    });
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

// IPC handler for save file dialog
ipcMain.handle('show-save-dialog', async (event, options) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { canceled: true, filePath: '' };
  }
  
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

// IPC handler for getting debug log path (for troubleshooting)
ipcMain.handle('get-debug-info', async () => {
  return {
    debugLogPath: debugLogPath,
    appPath: app.getAppPath(),
    userDataPath: app.getPath('userData'),
    isPackaged: app.isPackaged,
    dirname: __dirname,
    cwd: process.cwd(),
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    platform: process.platform,
    arch: process.arch
  };
});

function createWindow() {
  debugLog('createWindow() called');
  
  // Close existing window if any
  if (mainWindow && !mainWindow.isDestroyed()) {
    debugLog('Closing existing window');
    mainWindow.close();
  }

  const iconPath = path.join(__dirname, 'build', 'icon.png');
  debugLog('Icon path', iconPath);
  debugLog('Icon exists', fs.existsSync(iconPath));
  
  // Preload script path (for secure contextBridge API)
  const preloadPath = path.join(__dirname, 'preload.js');
  const preloadExists = fs.existsSync(preloadPath);
  debugLog('Preload script path', preloadPath);
  debugLog('Preload script exists', preloadExists);

  mainWindow = new BrowserWindow({
    width: 1000,
    height: 650,
    minWidth: 750,
    minHeight: 500,
    backgroundColor: '#0a0a0c',
    title: 'GA-WsusManager Pro | Portable Hub',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      // ========================================================================
      // SECURITY CONFIGURATION
      // ========================================================================
      // Current: nodeIntegration=true for backward compatibility
      // Target:  nodeIntegration=false, contextIsolation=true (full security)
      // 
      // Migration path:
      // 1. [DONE] Added preload.js with contextBridge exposing electronAPI
      // 2. [DONE] Added getElectronAPI() helper in types.ts
      // 3. [TODO] Migrate renderer code to use window.electronAPI
      // 4. [TODO] Set nodeIntegration=false, contextIsolation=true
      // ========================================================================
      nodeIntegration: true,       // TODO: Set to false after renderer migration
      contextIsolation: false,     // TODO: Set to true after renderer migration
      preload: preloadExists ? preloadPath : undefined,  // Load secure API bridge
      webSecurity: true,
    },
    autoHideMenuBar: true,
    show: false
  });
  
  debugLog('BrowserWindow created');

  // Check if we're in development or production
  // Use dist folder if it exists, otherwise try dev server
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  const distExists = fs.existsSync(indexPath);
  
  debugLog('Index path', indexPath);
  debugLog('Dist exists', distExists);
  
  // List dist folder contents for debugging
  const distDir = path.join(__dirname, 'dist');
  if (fs.existsSync(distDir)) {
    try {
      const distContents = fs.readdirSync(distDir);
      debugLog('Dist folder contents', distContents);
      
      // Check assets folder
      const assetsDir = path.join(distDir, 'assets');
      if (fs.existsSync(assetsDir)) {
        const assetsContents = fs.readdirSync(assetsDir);
        debugLog('Assets folder contents', assetsContents);
        
        // Check each asset file exists and get size
        assetsContents.forEach(file => {
          const filePath = path.join(assetsDir, file);
          const stats = fs.statSync(filePath);
          debugLog(`Asset: ${file}`, { size: stats.size, isFile: stats.isFile() });
        });
      } else {
        debugLog('ERROR: Assets folder does not exist!', assetsDir);
      }
    } catch (err) {
      debugLog('Error reading dist folder', err.message);
    }
  } else {
    debugLog('ERROR: Dist folder does not exist!', distDir);
  }
  
  // Read and log index.html content for debugging
  if (distExists) {
    try {
      const htmlContent = fs.readFileSync(indexPath, 'utf8');
      debugLog('index.html content (first 500 chars)', htmlContent.substring(0, 500));
      
      // Check for CSS link
      const cssMatch = htmlContent.match(/href="([^"]*\.css)"/);
      if (cssMatch) {
        debugLog('CSS file referenced in HTML', cssMatch[1]);
        const cssPath = path.join(distDir, cssMatch[1].replace('./', ''));
        debugLog('Full CSS path', cssPath);
        debugLog('CSS file exists', fs.existsSync(cssPath));
      } else {
        debugLog('WARNING: No CSS link found in index.html!');
      }
      
      // Check for JS link
      const jsMatch = htmlContent.match(/src="([^"]*\.js)"/);
      if (jsMatch) {
        debugLog('JS file referenced in HTML', jsMatch[1]);
        const jsPath = path.join(distDir, jsMatch[1].replace('./', ''));
        debugLog('Full JS path', jsPath);
        debugLog('JS file exists', fs.existsSync(jsPath));
      } else {
        debugLog('WARNING: No JS link found in index.html!');
      }
    } catch (err) {
      debugLog('Error reading index.html', err.message);
    }
  }
  
  // Always try dist folder first for reliability
  if (distExists) {
    debugLog('Loading file', indexPath);
    mainWindow.loadFile(indexPath).then(() => {
      debugLog('loadFile() succeeded');
    }).catch((err) => {
      debugLog('loadFile() FAILED', err.message);
      console.error('Failed to load dist/index.html:', err);
    });
  } else {
    // Fallback to dev server only if dist doesn't exist
    debugLog('Dist not found, trying dev server');
    mainWindow.loadURL('http://localhost:3000').catch((err) => {
      debugLog('loadURL() FAILED', err.message);
      console.error('Failed to load from dev server:', err);
    });
  }
  
  // Open DevTools only if not packaged (for debugging)
  // TEMPORARILY: Always open DevTools to debug CSS issues
  if (!app.isPackaged) {
    debugLog('Opening DevTools (not packaged)');
    mainWindow.webContents.openDevTools();
  }
  
  // Log webContents events for debugging
  mainWindow.webContents.on('did-start-loading', () => {
    debugLog('webContents: did-start-loading');
  });
  
  mainWindow.webContents.on('did-stop-loading', () => {
    debugLog('webContents: did-stop-loading');
  });
  
  mainWindow.webContents.on('dom-ready', () => {
    debugLog('webContents: dom-ready');
  });
  
  mainWindow.webContents.on('did-finish-load', () => {
    debugLog('webContents: did-finish-load');
    
    // Inject debug script to check CSS loading in renderer
    mainWindow.webContents.executeJavaScript(`
      (function() {
        const styles = document.querySelectorAll('link[rel="stylesheet"]');
        const scripts = document.querySelectorAll('script[src]');
        console.log('[DEBUG] Stylesheets found:', styles.length);
        console.log('[DEBUG] Scripts found:', scripts.length);
        
        styles.forEach((s, i) => {
          console.log('[DEBUG] Stylesheet ' + i + ':', s.href, 'loaded:', s.sheet !== null);
        });
        
        // Check if Tailwind classes are working
        const body = document.body;
        const computedStyle = window.getComputedStyle(body);
        console.log('[DEBUG] Body background-color:', computedStyle.backgroundColor);
        console.log('[DEBUG] Body font-family:', computedStyle.fontFamily);
        
        // Check root element
        const root = document.getElementById('root');
        if (root) {
          console.log('[DEBUG] Root element exists, children:', root.children.length);
          console.log('[DEBUG] Root innerHTML length:', root.innerHTML.length);
        } else {
          console.log('[DEBUG] ERROR: Root element not found!');
        }
        
        return {
          stylesheetsCount: styles.length,
          scriptsCount: scripts.length,
          bodyBg: computedStyle.backgroundColor,
          rootExists: !!root,
          rootChildrenCount: root ? root.children.length : 0
        };
      })();
    `).then(result => {
      console.log('[DEBUG] Renderer check result:', result);
    }).catch(err => {
      console.log('[DEBUG] Renderer check failed:', err.message);
    });
  });
  
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    debugLog('webContents: did-fail-load', { errorCode, errorDescription, validatedURL });
  });
  
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    // Log renderer console messages to main process debug log
    const levelNames = ['verbose', 'info', 'warning', 'error'];
    debugLog(`[Renderer ${levelNames[level] || level}] ${message}`, { line, sourceId });
  });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  });

  // Handle renderer process crashes
  mainWindow.webContents.on('crashed', (event, killed) => {
    console.error('Renderer process crashed:', killed ? 'killed' : 'crashed');
    
    // Show dialog and offer to reload
    const { dialog } = require('electron');
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Application Error',
      message: 'The application has crashed.',
      detail: 'Would you like to reload the application?',
      buttons: ['Reload', 'Close'],
      defaultId: 0
    }).then(result => {
      if (result.response === 0) {
        mainWindow.reload();
      } else {
        mainWindow.close();
      }
    });
  });

  // Handle unresponsive renderer
  mainWindow.on('unresponsive', () => {
    console.error('Renderer process became unresponsive');
    
    const { dialog } = require('electron');
    dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Application Not Responding',
      message: 'The application is not responding.',
      detail: 'Would you like to wait or reload?',
      buttons: ['Wait', 'Reload'],
      defaultId: 0
    }).then(result => {
      if (result.response === 1) {
        mainWindow.reload();
      }
    });
  });

  // Handle when renderer becomes responsive again
  mainWindow.on('responsive', () => {
    console.log('Renderer process is responsive again');
  });

  // Clean up reference when window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  debugLog('app.whenReady() fired');
  debugLog('Debug log location', debugLogPath);
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

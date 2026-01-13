# Building the GA-WsusManager Pro Executable

## Issue
Electron-builder is trying to extract code signing tools but failing due to Windows symbolic link permissions. This requires either:
1. Windows Developer Mode enabled, or
2. Running as Administrator

## Workaround Options

### Option 1: Enable Developer Mode (Recommended)
1. Open Windows Settings
2. Go to Privacy & Security > For developers
3. Enable "Developer Mode"
4. Run `npm run build:exe` again

### Option 2: Run as Administrator
1. Open PowerShell as Administrator
2. Navigate to the project directory
3. Run `npm run build:exe`

### Option 3: Use Unpacked Build
The app can be run directly from the unpacked directory:
```bash
npm run build
npx electron-builder --win --dir
```
Then run `release\win-unpacked\GA-WsusManager Pro.exe`

### Option 4: Manual Packaging
After building with `npm run build`, you can manually package the app using the files in the `dist` folder and `main.js`.

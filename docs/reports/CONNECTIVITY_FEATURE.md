# 🌐 Automatic Air-Gap Mode Detection

## Feature Overview

The application now **automatically detects internet connectivity** and switches to **Air-Gap mode** when no internet connection is available.

## How It Works

### Automatic Detection
1. **On Startup**: Checks internet connectivity immediately
2. **If Offline**: Automatically enables Air-Gap mode
3. **If Online**: Allows user to choose mode (defaults to Air-Gap for security)

### Continuous Monitoring
- Checks connectivity every **30 seconds**
- Listens to browser `online`/`offline` events
- Automatically switches to Air-Gap mode when connection is lost
- Prevents switching to Cloud-Sync when offline

### Connectivity Checks
The system checks multiple reliable sources:
- Google (favicon.ico)
- Microsoft (favicon.ico)  
- Cloudflare DNS (1.1.1.1)

Uses 5-second timeout per check to avoid blocking.

## User Experience

### Automatic Behavior
- **No Internet Detected**: App automatically switches to Air-Gap mode
- **Connection Lost**: App automatically switches to Air-Gap mode
- **Connection Restored**: App stays in current mode (user can manually switch)

### Manual Override
- Users can still manually toggle between modes
- Switching to Cloud-Sync requires active internet connection
- If offline, toggle to Cloud-Sync is blocked with warning

## Implementation Details

### Files Modified
- `utils/connectivityChecker.ts` - New connectivity detection utility
- `services/stateService.ts` - Added `setAirGapFromConnectivity()` method
- `App.tsx` - Integrated connectivity monitoring

### Key Functions

**connectivityChecker.ts:**
- `checkConnectivity()` - Checks if internet is available
- `startConnectivityMonitoring()` - Starts periodic checks
- `stopConnectivityMonitoring()` - Stops monitoring
- `getConnectivityStatus()` - Gets current status (sync)
- `checkConnectivityOnce()` - One-time async check

**stateService.ts:**
- `setAirGapFromConnectivity(isOnline)` - Auto-switches based on connectivity

**App.tsx:**
- Monitors connectivity on mount
- Updates air-gap mode automatically
- Prevents invalid mode switches

## Benefits

1. **Automatic**: No user intervention needed
2. **Reliable**: Multiple connectivity checks
3. **Fast**: Detects offline status quickly
4. **User-Friendly**: Clear feedback and prevention of invalid actions
5. **Secure**: Defaults to Air-Gap mode when uncertain

## Testing

### Test Scenarios

1. **Start App Offline**
   - Expected: Automatically in Air-Gap mode
   - Log: "No internet connection detected - automatically enabling AIR-GAP mode"

2. **Lose Connection While Running**
   - Expected: Automatically switches to Air-Gap mode
   - Log: "Internet connection lost - automatically switching to AIR-GAP mode"

3. **Try to Switch to Cloud-Sync While Offline**
   - Expected: Toggle blocked, warning logged
   - Log: "Cannot switch to Cloud-Sync mode - no internet connection detected"

4. **Connection Restored**
   - Expected: Stays in current mode (user can manually switch)

## Configuration

### Check Interval
Default: 30 seconds
- Can be adjusted in `connectivityChecker.ts`: `CONNECTIVITY_CHECK_INTERVAL_MS`

### Timeout
Default: 5 seconds per check
- Can be adjusted in `connectivityChecker.ts`: `CONNECTIVITY_CHECK_TIMEOUT_MS`

### Check URLs
Default: Google, Microsoft, Cloudflare DNS
- Can be modified in `connectivityChecker.ts`: `CONNECTIVITY_CHECK_URLS`

---

**Feature Status**: ✅ **IMPLEMENTED AND ACTIVE**

The app will automatically detect when there's no internet connection and switch to Air-Gap mode to ensure proper operation in offline environments.

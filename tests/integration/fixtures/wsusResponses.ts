/**
 * WSUS Test Fixtures
 * Realistic mock data for integration testing
 */

// =========================================================================
// Computer Fixtures
// =========================================================================
export const COMPUTER_LIST = [
  {
    Name: 'PC001.corp.local',
    IPAddress: '192.168.1.101',
    OS: 'Windows 10 Enterprise',
    Status: 'Healthy',
    LastSync: '2024-01-15 10:30',
    UpdatesNeeded: 0,
    UpdatesInstalled: 150,
    TargetGroup: 'Workstations'
  },
  {
    Name: 'PC002.corp.local',
    IPAddress: '192.168.1.102',
    OS: 'Windows 11 Pro',
    Status: 'Warning',
    LastSync: '2024-01-10 08:15',
    UpdatesNeeded: 5,
    UpdatesInstalled: 145,
    TargetGroup: 'Workstations'
  },
  {
    Name: 'SVR001.corp.local',
    IPAddress: '192.168.1.10',
    OS: 'Windows Server 2022',
    Status: 'Critical',
    LastSync: '2023-12-01 14:00',
    UpdatesNeeded: 25,
    UpdatesInstalled: 100,
    TargetGroup: 'Servers'
  },
  {
    Name: 'SVR002.corp.local',
    IPAddress: '192.168.1.11',
    OS: 'Windows Server 2019',
    Status: 'Healthy',
    LastSync: '2024-01-15 06:00',
    UpdatesNeeded: 2,
    UpdatesInstalled: 200,
    TargetGroup: 'Servers'
  },
  {
    Name: 'LAPTOP001.corp.local',
    IPAddress: '192.168.2.50',
    OS: 'Windows 11 Pro',
    Status: 'Warning',
    LastSync: '2024-01-12 16:45',
    UpdatesNeeded: 8,
    UpdatesInstalled: 120,
    TargetGroup: 'Laptops'
  }
];

// =========================================================================
// Stats Fixtures
// =========================================================================
export const HEALTHY_STATS = {
  TotalComputers: 50,
  HealthyComputers: 45,
  WarningComputers: 4,
  CriticalComputers: 1,
  TotalUpdates: 2500,
  SecurityUpdatesCount: 350,
  WsusServiceStatus: 'Running',
  SqlServiceStatus: 'Running',
  IISServiceStatus: 'Running'
};

export const DEGRADED_STATS = {
  TotalComputers: 50,
  HealthyComputers: 20,
  WarningComputers: 15,
  CriticalComputers: 15,
  TotalUpdates: 3000,
  SecurityUpdatesCount: 500,
  WsusServiceStatus: 'Running',
  SqlServiceStatus: 'Running',
  IISServiceStatus: 'Stopped'
};

export const DISK_INFO = {
  FreeGB: 250.5
};

export const DISK_INFO_LOW = {
  FreeGB: 5.2
};

// =========================================================================
// Update Fixtures
// =========================================================================
export const PENDING_UPDATES = [
  {
    Id: 'update-001-guid',
    Title: '2024-01 Cumulative Update for Windows 10 (KB5001234)',
    Classification: 'Security Updates',
    Severity: 'Critical',
    ReleaseDate: '2024-01-10'
  },
  {
    Id: 'update-002-guid',
    Title: '2024-01 Security Update for Windows Server 2022 (KB5001235)',
    Classification: 'Security Updates',
    Severity: 'Important',
    ReleaseDate: '2024-01-09'
  },
  {
    Id: 'update-003-guid',
    Title: '.NET Framework 4.8 Security Update (KB5001236)',
    Classification: 'Security Updates',
    Severity: 'Important',
    ReleaseDate: '2024-01-08'
  },
  {
    Id: 'update-004-guid',
    Title: 'Windows Malicious Software Removal Tool - January 2024',
    Classification: 'Update Rollups',
    Severity: 'Moderate',
    ReleaseDate: '2024-01-10'
  },
  {
    Id: 'update-005-guid',
    Title: 'Intel Driver Update (KB5001237)',
    Classification: 'Drivers',
    Severity: 'Low',
    ReleaseDate: '2024-01-05'
  }
];

// =========================================================================
// Maintenance Fixtures
// =========================================================================
export const MAINTENANCE_RESULTS = {
  declineSuperseded: { Declined: 150, Errors: 0 },
  declineOld: { Declined: 75, Errors: 2 },
  autoApprove: { Approved: 25, Skipped: 10, Errors: 0 }
};

export const MAINTENANCE_PARTIAL_FAILURE = {
  declineSuperseded: { Declined: 100, Errors: 50 },
  declineOld: { Declined: 0, Errors: 75 },
  autoApprove: { Approved: 5, Skipped: 0, Errors: 20 }
};

// =========================================================================
// Health Check Fixtures
// =========================================================================
export const HEALTH_CHECK_HEALTHY = {
  Healthy: true,
  Services: [
    { Name: 'WSUS Service', Status: 'Running', Healthy: true },
    { Name: 'SQL Server', Status: 'Running', Healthy: true },
    { Name: 'IIS (W3SVC)', Status: 'Running', Healthy: true }
  ],
  Database: {
    Connected: true,
    SizeGB: 5.5,
    LastBackup: '2024-01-15 02:00'
  },
  Sync: {
    LastSync: '2024-01-15 06:00',
    NextSync: '2024-01-16 06:00',
    Status: 'NotProcessing'
  },
  Issues: []
};

export const HEALTH_CHECK_DEGRADED = {
  Healthy: false,
  Services: [
    { Name: 'WSUS Service', Status: 'Running', Healthy: true },
    { Name: 'SQL Server', Status: 'Running', Healthy: true },
    { Name: 'IIS (W3SVC)', Status: 'Stopped', Healthy: false }
  ],
  Database: {
    Connected: true,
    SizeGB: 15.2,
    LastBackup: '2023-12-01 02:00'
  },
  Sync: {
    LastSync: '2024-01-01 06:00',
    NextSync: '2024-01-16 06:00',
    Status: 'NotProcessing'
  },
  Issues: [
    'IIS is not running',
    'No database backup in over 30 days',
    'WSUS has not synchronized in over 7 days'
  ]
};

export const HEALTH_CHECK_CRITICAL = {
  Healthy: false,
  Services: [
    { Name: 'WSUS Service', Status: 'Stopped', Healthy: false },
    { Name: 'SQL Server', Status: 'Stopped', Healthy: false },
    { Name: 'IIS (W3SVC)', Status: 'Stopped', Healthy: false }
  ],
  Database: {
    Connected: false,
    SizeGB: 0,
    LastBackup: 'Never'
  },
  Sync: {
    LastSync: 'Unknown',
    NextSync: 'Unknown',
    Status: 'Unknown'
  },
  Issues: [
    'WSUS Service is not running',
    'SQL Server is not running',
    'IIS is not running',
    'Cannot connect to SUSDB database'
  ]
};

// =========================================================================
// Error Response Fixtures
// =========================================================================
export const ERROR_RESPONSES = {
  wsusNotInstalled: {
    success: false,
    stdout: '',
    stderr: 'Get-WsusServer : The term \'Get-WsusServer\' is not recognized',
    exitCode: 1
  },
  connectionRefused: {
    success: false,
    stdout: '',
    stderr: 'Unable to connect to the remote server',
    exitCode: 1
  },
  accessDenied: {
    success: false,
    stdout: '',
    stderr: 'Access is denied. (Exception from HRESULT: 0x80070005)',
    exitCode: 1
  },
  timeout: {
    success: false,
    stdout: '',
    stderr: 'The operation has timed out',
    exitCode: 1
  },
  databaseError: {
    success: false,
    stdout: '',
    stderr: 'A network-related or instance-specific error occurred',
    exitCode: 1
  }
};

// =========================================================================
// Helper Functions
// =========================================================================
export function createSuccessResponse<T>(data: T): { success: boolean; stdout: string; stderr: string; exitCode: number } {
  return {
    success: true,
    stdout: JSON.stringify(data),
    stderr: '',
    exitCode: 0
  };
}

export function createMixedResponse<T>(progress: string[], data: T): { success: boolean; stdout: string; stderr: string; exitCode: number } {
  return {
    success: true,
    stdout: [...progress, JSON.stringify(data)].join('\n'),
    stderr: '',
    exitCode: 0
  };
}

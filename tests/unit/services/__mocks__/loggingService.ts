/**
 * Mock Logging Service for Unit Tests
 * Captures log calls for verification
 */

// Mock functions
export const mockInfo = jest.fn();
export const mockWarn = jest.fn();
export const mockError = jest.fn();
export const mockGetLogs = jest.fn(() => []);
export const mockClearLogs = jest.fn();
export const mockExportLogs = jest.fn(() => Promise.resolve(true));

// Mock service object
export const loggingService = {
  info: mockInfo,
  warn: mockWarn,
  error: mockError,
  getLogs: mockGetLogs,
  clearLogs: mockClearLogs,
  exportLogs: mockExportLogs,
};

/**
 * Reset all mock functions
 */
export function resetMocks(): void {
  mockInfo.mockReset();
  mockWarn.mockReset();
  mockError.mockReset();
  mockGetLogs.mockReset();
  mockClearLogs.mockReset();
  mockExportLogs.mockReset();
}

/**
 * Check if an error was logged containing the substring
 */
export function expectErrorLogged(substring: string): void {
  expect(mockError).toHaveBeenCalledWith(
    expect.stringContaining(substring),
    expect.anything()
  );
}

/**
 * Check if an error was logged (simple version)
 */
export function expectErrorLoggedSimple(substring: string): void {
  expect(mockError).toHaveBeenCalledWith(
    expect.stringContaining(substring)
  );
}

/**
 * Check if info was logged containing the substring
 */
export function expectInfoLogged(substring: string): void {
  expect(mockInfo).toHaveBeenCalledWith(
    expect.stringContaining(substring)
  );
}

/**
 * Check if warning was logged containing the substring
 */
export function expectWarnLogged(substring: string): void {
  expect(mockWarn).toHaveBeenCalledWith(
    expect.stringContaining(substring)
  );
}

/**
 * Get all calls to a specific log level
 */
export function getLogCalls(level: 'info' | 'warn' | 'error'): unknown[][] {
  const mock = level === 'info' ? mockInfo : level === 'warn' ? mockWarn : mockError;
  return mock.mock.calls;
}

export default loggingService;

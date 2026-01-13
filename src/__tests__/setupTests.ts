/**
 * Jest test setup file
 * Configures testing environment and global mocks
 */

import '@testing-library/jest-dom';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn((key: string) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: jest.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock crypto.subtle for Web Crypto API
const cryptoMock = {
  subtle: {
    encrypt: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
    decrypt: jest.fn().mockResolvedValue(new ArrayBuffer(16)),
    importKey: jest.fn().mockResolvedValue({}),
    deriveKey: jest.fn().mockResolvedValue({}),
    digest: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
  },
  getRandomValues: jest.fn((arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  }),
};

Object.defineProperty(window, 'crypto', { value: cryptoMock });

// Mock ResizeObserver
class ResizeObserverMock {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

Object.defineProperty(window, 'ResizeObserver', { value: ResizeObserverMock });

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock scrollTo
Object.defineProperty(window, 'scrollTo', { value: jest.fn() });

// Mock console methods for cleaner test output
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  // Suppress React 18 act() warnings in tests
  if (typeof args[0] === 'string' && args[0].includes('act(')) {
    return;
  }
  originalConsoleError.apply(console, args);
};

// Global test utilities
beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
});

// Increase default timeout for async tests
jest.setTimeout(10000);

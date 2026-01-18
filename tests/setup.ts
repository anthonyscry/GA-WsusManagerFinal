/**
 * Jest Global Test Setup
 * Provides mocks for browser APIs used by services
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: jest.fn((key: string) => localStorageMock.store[key] || null),
  setItem: jest.fn((key: string, value: string) => {
    localStorageMock.store[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    delete localStorageMock.store[key];
  }),
  clear: jest.fn(() => {
    localStorageMock.store = {};
  }),
  get length() {
    return Object.keys(localStorageMock.store).length;
  },
  key: jest.fn((index: number) => {
    const keys = Object.keys(localStorageMock.store);
    return keys[index] || null;
  }),
};

// Mock sessionStorage (same structure)
const sessionStorageMock = {
  store: {} as Record<string, string>,
  getItem: jest.fn((key: string) => sessionStorageMock.store[key] || null),
  setItem: jest.fn((key: string, value: string) => {
    sessionStorageMock.store[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    delete sessionStorageMock.store[key];
  }),
  clear: jest.fn(() => {
    sessionStorageMock.store = {};
  }),
  get length() {
    return Object.keys(sessionStorageMock.store).length;
  },
  key: jest.fn((index: number) => {
    const keys = Object.keys(sessionStorageMock.store);
    return keys[index] || null;
  }),
};

// Mock crypto.getRandomValues
const cryptoMock = {
  getRandomValues: <T extends ArrayBufferView>(array: T): T => {
    if (array instanceof Uint8Array) {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    return array;
  },
  subtle: {
    importKey: jest.fn(),
    deriveKey: jest.fn(),
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  },
  randomUUID: jest.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9)),
};

// Mock window object
Object.defineProperty(global, 'window', {
  value: {
    localStorage: localStorageMock,
    sessionStorage: sessionStorageMock,
    crypto: cryptoMock,
    dispatchEvent: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    CustomEvent: class CustomEvent extends Event {
      detail: unknown;
      constructor(type: string, options?: { detail?: unknown }) {
        super(type);
        this.detail = options?.detail;
      }
    },
  },
  writable: true,
});

// Make storage available globally
Object.defineProperty(global, 'localStorage', { value: localStorageMock });
Object.defineProperty(global, 'sessionStorage', { value: sessionStorageMock });
Object.defineProperty(global, 'crypto', { value: cryptoMock });

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.store = {};
  sessionStorageMock.store = {};
});

// Increase timeout for integration tests
jest.setTimeout(30000);

// Suppress console.warn and console.error in tests unless debugging
const originalWarn = console.warn;
const originalError = console.error;

beforeAll(() => {
  if (!process.env.DEBUG_TESTS) {
    console.warn = jest.fn();
    console.error = jest.fn();
  }
});

afterAll(() => {
  console.warn = originalWarn;
  console.error = originalError;
});

export { localStorageMock, sessionStorageMock, cryptoMock };

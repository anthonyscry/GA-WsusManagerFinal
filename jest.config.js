/**
 * Jest configuration for unit and integration tests
 * Lightweight test setup for standalone portable app
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/tests/**/*.test.ts'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/e2e/'  // Playwright tests run separately via npx playwright test
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    'services/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/index.ts',
    '!**/node_modules/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    'services/wsus/*.ts': {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    },
    'services/powershellService.ts': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  globals: {
    'ts-jest': {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    },
  },
  // Tests can be run with: npm test
  // Coverage report: npm test -- --coverage
};

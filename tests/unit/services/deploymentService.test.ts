/**
 * Unit Tests for Deployment Service
 * Tests automated deployment pipeline
 */

import type { PowerShellResult } from '../../../types';
import type { DeploymentConfig, DeploymentProgress } from '../../../services/deploymentService';

// Mock powershellService
const mockExecute = jest.fn<Promise<PowerShellResult>, [string, number?]>();
jest.mock('../../../services/powershellService', () => ({
  powershellService: {
    execute: mockExecute,
  }
}));

// Mock loggingService
jest.mock('../../../services/loggingService', () => ({
  loggingService: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}));

// Import after mocking
import { deploymentService } from '../../../services/deploymentService';

// Helper functions
function createSuccessResult(stdout: string = ''): PowerShellResult {
  return { success: true, stdout, stderr: '', exitCode: 0 };
}

function createFailureResult(stderr: string): PowerShellResult {
  return { success: false, stdout: '', stderr, exitCode: 1 };
}

// Test config factory
function createTestConfig(overrides: Partial<DeploymentConfig> = {}): DeploymentConfig {
  return {
    sqlExpressInstallerPath: 'C:\\Installers\\SQLEXPR_x64.exe',
    ssmsInstallerPath: 'C:\\Installers\\SSMS-Setup.exe',
    saPassword: 'SecureP@ss123!',
    instanceName: 'WSUSEXPRESS',
    sqlDataPath: 'C:\\SQLData',
    wsusContentPath: 'C:\\WSUS\\Content',
    ...overrides,
  };
}

describe('Deployment Service', () => {
  let progressCallback: jest.Mock<void, [DeploymentProgress]>;
  let progressUpdates: DeploymentProgress[];

  beforeEach(() => {
    jest.clearAllMocks();
    progressUpdates = [];
    progressCallback = jest.fn((progress: DeploymentProgress) => {
      progressUpdates.push(progress);
    });
  });

  // =========================================================================
  // runFullDeployment() Tests
  // =========================================================================
  describe('runFullDeployment()', () => {
    
    describe('successful deployment', () => {
      it('should complete all steps successfully', async () => {
        // Mock all 4 steps succeeding
        mockExecute
          .mockResolvedValueOnce(createSuccessResult('[SQL] Installation completed successfully'))
          .mockResolvedValueOnce(createSuccessResult('[SSMS] Installation completed successfully'))
          .mockResolvedValueOnce(createSuccessResult('[WSUS] Feature installation completed'))
          .mockResolvedValueOnce(createSuccessResult('[WSUS] Post-install configuration completed'));
        
        const config = createTestConfig();
        const result = await deploymentService.runFullDeployment(config, progressCallback);
        
        expect(result).toBe(true);
        expect(progressCallback).toHaveBeenCalled();
        
        // Check final progress
        const lastProgress = progressUpdates[progressUpdates.length - 1];
        expect(lastProgress.step).toBe('complete');
        expect(lastProgress.progress).toBe(100);
      });

      it('should report progress at each step', async () => {
        mockExecute
          .mockResolvedValueOnce(createSuccessResult())
          .mockResolvedValueOnce(createSuccessResult())
          .mockResolvedValueOnce(createSuccessResult())
          .mockResolvedValueOnce(createSuccessResult());
        
        await deploymentService.runFullDeployment(createTestConfig(), progressCallback);
        
        const steps = progressUpdates.map(p => p.step);
        expect(steps).toContain('sql-express');
        expect(steps).toContain('ssms');
        expect(steps).toContain('wsus-feature');
        expect(steps).toContain('wsus-config');
        expect(steps).toContain('complete');
      });
    });

    describe('step failures', () => {
      it('should return false if SQL Express installation fails', async () => {
        mockExecute.mockResolvedValueOnce(createFailureResult('Installation failed'));
        
        const result = await deploymentService.runFullDeployment(createTestConfig(), progressCallback);
        
        expect(result).toBe(false);
        expect(progressUpdates.some(p => p.step === 'error')).toBe(true);
      });

      it('should return false if SSMS installation fails', async () => {
        mockExecute
          .mockResolvedValueOnce(createSuccessResult()) // SQL Express succeeds
          .mockResolvedValueOnce(createFailureResult('SSMS failed'));
        
        const result = await deploymentService.runFullDeployment(createTestConfig(), progressCallback);
        
        expect(result).toBe(false);
      });

      it('should return false if WSUS feature installation fails', async () => {
        mockExecute
          .mockResolvedValueOnce(createSuccessResult())
          .mockResolvedValueOnce(createSuccessResult())
          .mockResolvedValueOnce(createFailureResult('Feature installation failed'));
        
        const result = await deploymentService.runFullDeployment(createTestConfig(), progressCallback);
        
        expect(result).toBe(false);
      });

      it('should return false if WSUS configuration fails', async () => {
        mockExecute
          .mockResolvedValueOnce(createSuccessResult())
          .mockResolvedValueOnce(createSuccessResult())
          .mockResolvedValueOnce(createSuccessResult())
          .mockResolvedValueOnce(createFailureResult('Configuration failed'));
        
        const result = await deploymentService.runFullDeployment(createTestConfig(), progressCallback);
        
        expect(result).toBe(false);
      });
    });

    describe('concurrent deployment prevention', () => {
      it('should reject second deployment while one is running', async () => {
        // Make first deployment slow
        mockExecute.mockImplementation(() => 
          new Promise(resolve => setTimeout(() => resolve(createSuccessResult()), 100))
        );
        
        const config = createTestConfig();
        
        // Start first deployment (don't await)
        const firstDeployment = deploymentService.runFullDeployment(config, progressCallback);
        
        // Try to start second deployment immediately
        const secondCallback = jest.fn();
        const secondResult = await deploymentService.runFullDeployment(config, secondCallback);
        
        expect(secondResult).toBe(false);
        
        // Wait for first to complete
        await firstDeployment;
      });

      it('should allow new deployment after previous completes', async () => {
        mockExecute.mockResolvedValue(createSuccessResult());
        
        const config = createTestConfig();
        
        // First deployment
        await deploymentService.runFullDeployment(config, progressCallback);
        
        // Reset mocks
        progressUpdates = [];
        progressCallback.mockClear();
        
        // Second deployment should work
        const result = await deploymentService.runFullDeployment(config, progressCallback);
        
        expect(result).toBe(true);
      });
    });

    describe('exception handling', () => {
      it('should handle thrown exceptions', async () => {
        mockExecute.mockRejectedValue(new Error('Unexpected error'));
        
        const result = await deploymentService.runFullDeployment(createTestConfig(), progressCallback);
        
        expect(result).toBe(false);
        expect(progressUpdates.some(p => p.step === 'error')).toBe(true);
      });

      it('should reset isRunning flag after exception', async () => {
        mockExecute.mockRejectedValue(new Error('Error'));
        
        await deploymentService.runFullDeployment(createTestConfig(), progressCallback);
        
        // Should allow another deployment
        mockExecute.mockResolvedValue(createSuccessResult());
        const result = await deploymentService.runFullDeployment(createTestConfig(), progressCallback);
        
        expect(result).toBe(true);
      });
    });
  });

  // =========================================================================
  // isDeploymentRunning() Tests
  // =========================================================================
  describe('isDeploymentRunning()', () => {
    
    it('should return false when no deployment is running', () => {
      expect(deploymentService.isDeploymentRunning()).toBe(false);
    });
  });

  // =========================================================================
  // Configuration Handling Tests
  // =========================================================================
  describe('configuration handling', () => {
    
    it('should escape special characters in password', async () => {
      mockExecute.mockResolvedValue(createSuccessResult());
      
      const config = createTestConfig({
        saPassword: 'Pass$word"with\'special'
      });
      
      await deploymentService.runFullDeployment(config, progressCallback);
      
      // Password should be escaped in the script
      const script = mockExecute.mock.calls[0][0];
      expect(script).toContain('Pass`$word');
    });

    it('should escape backslashes in paths', async () => {
      mockExecute.mockResolvedValue(createSuccessResult());
      
      const config = createTestConfig({
        sqlDataPath: 'C:\\Program Files\\SQL\\Data'
      });
      
      await deploymentService.runFullDeployment(config, progressCallback);
      
      const script = mockExecute.mock.calls[0][0];
      expect(script).toContain('C:\\\\Program Files\\\\SQL\\\\Data');
    });

    it('should handle ZIP installer paths', async () => {
      mockExecute.mockResolvedValue(createSuccessResult());
      
      const config = createTestConfig({
        sqlExpressInstallerPath: 'C:\\Downloads\\SQLEXPR.zip'
      });
      
      await deploymentService.runFullDeployment(config, progressCallback);
      
      const script = mockExecute.mock.calls[0][0];
      expect(script).toContain('SQLEXPR.zip');
    });
  });

  // =========================================================================
  // Timeout Configuration Tests
  // =========================================================================
  describe('timeout configuration', () => {
    
    it('should use 15 minute timeout for SQL Express installation', async () => {
      mockExecute.mockResolvedValue(createSuccessResult());
      
      await deploymentService.runFullDeployment(createTestConfig(), progressCallback);
      
      // First call is SQL Express, should have 900000ms timeout
      expect(mockExecute).toHaveBeenNthCalledWith(1, expect.any(String), 900000);
    });

    it('should use 15 minute timeout for SSMS installation', async () => {
      mockExecute.mockResolvedValue(createSuccessResult());
      
      await deploymentService.runFullDeployment(createTestConfig(), progressCallback);
      
      // Second call is SSMS
      expect(mockExecute).toHaveBeenNthCalledWith(2, expect.any(String), 900000);
    });
  });
});

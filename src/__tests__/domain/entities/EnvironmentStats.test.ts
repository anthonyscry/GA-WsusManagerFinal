/**
 * Unit tests for EnvironmentStats domain entity
 * Tests business logic and validation
 */

import { EnvironmentStats } from '../../../domain/entities/EnvironmentStats';
import { createDatabaseMetrics } from '../../../domain/value-objects/DatabaseMetrics';

describe('EnvironmentStats Entity', () => {
  describe('Creation and Validation', () => {
    it('should create valid stats', () => {
      const stats = new EnvironmentStats(
        10,
        8,
        1,
        1,
        100,
        50,
        [],
        createDatabaseMetrics(5, 10, 'INSTANCE', 'C:\\Path', '2024-01-01'),
        true,
        100,
        'Ready'
      );

      expect(stats.totalComputers).toBe(10);
      expect(stats.healthyComputers).toBe(8);
    });

    it('should throw error if sum exceeds total', () => {
      expect(() => {
        new EnvironmentStats(
          10,
          5,
          3,
          3, // Sum = 11 > 10
          100,
          50,
          [],
          createDatabaseMetrics(5, 10, 'INSTANCE', 'C:\\Path', '2024-01-01'),
          true,
          100,
          'Ready'
        );
      }).toThrow('Sum of health status counts cannot exceed total computers');
    });
  });

  describe('Business Logic', () => {
    it('should calculate compliance percentage', () => {
      const stats = new EnvironmentStats(
        10,
        8,
        1,
        1,
        100,
        50,
        [],
        createDatabaseMetrics(5, 10, 'INSTANCE', 'C:\\Path', '2024-01-01'),
        true,
        100,
        'Ready'
      );

      expect(stats.compliancePercentage).toBe(80);
    });

    it('should identify healthy environment', () => {
      const stats = new EnvironmentStats(
        10,
        9,
        1,
        0,
        100,
        50,
        [],
        createDatabaseMetrics(5, 10, 'INSTANCE', 'C:\\Path', '2024-01-01'),
        true,
        100,
        'Ready'
      );

      expect(stats.isHealthy()).toBe(true);
    });

    it('should identify environment needing attention', () => {
      const stats = new EnvironmentStats(
        10,
        5,
        2,
        3,
        100,
        50,
        [],
        createDatabaseMetrics(5, 10, 'INSTANCE', 'C:\\Path', '2024-01-01'),
        true,
        100,
        'Ready'
      );

      expect(stats.needsAttention()).toBe(true);
    });
  });
});

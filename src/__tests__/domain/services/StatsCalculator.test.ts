/**
 * Unit tests for StatsCalculator domain service
 */

import { StatsCalculator } from '../../../domain/services/StatsCalculator';
import { Computer } from '../../../domain/entities/Computer';
import { HealthStatus } from '../../../domain/value-objects/HealthStatus';

describe('StatsCalculator', () => {
  describe('calculateFromComputers', () => {
    it('should calculate correct distribution', () => {
      const computers = [
        new Computer('1', 'PC1', '192.168.1.1', 'Windows 10', HealthStatus.HEALTHY, new Date(), 0, 10, 'Group1'),
        new Computer('2', 'PC2', '192.168.1.2', 'Windows 10', HealthStatus.HEALTHY, new Date(), 0, 10, 'Group1'),
        new Computer('3', 'PC3', '192.168.1.3', 'Windows 10', HealthStatus.WARNING, new Date(), 5, 5, 'Group1'),
        new Computer('4', 'PC4', '192.168.1.4', 'Windows 10', HealthStatus.CRITICAL, new Date(), 10, 0, 'Group1'),
      ];

      const distribution = StatsCalculator.calculateFromComputers(computers);

      expect(distribution.healthy).toBe(2);
      expect(distribution.warning).toBe(1);
      expect(distribution.critical).toBe(1);
      expect(distribution.total).toBe(4);
    });

    it('should handle empty array', () => {
      const distribution = StatsCalculator.calculateFromComputers([]);

      expect(distribution.healthy).toBe(0);
      expect(distribution.warning).toBe(0);
      expect(distribution.critical).toBe(0);
      expect(distribution.total).toBe(0);
    });
  });

  describe('calculateAverageCompliance', () => {
    it('should calculate average compliance', () => {
      const computers = [
        new Computer('1', 'PC1', '192.168.1.1', 'Windows 10', HealthStatus.HEALTHY, new Date(), 0, 10, 'Group1'), // 100%
        new Computer('2', 'PC2', '192.168.1.2', 'Windows 10', HealthStatus.HEALTHY, new Date(), 5, 5, 'Group1'), // 50%
      ];

      const average = StatsCalculator.calculateAverageCompliance(computers);
      expect(average).toBe(75); // (100 + 50) / 2
    });
  });
});

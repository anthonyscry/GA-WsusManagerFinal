/**
 * Unit tests for Computer domain entity
 * Tests business logic and validation
 */

import { Computer } from '../../../domain/entities/Computer';
import { HealthStatus } from '../../../domain/value-objects/HealthStatus';

describe('Computer Entity', () => {
  describe('Creation and Validation', () => {
    it('should create a valid computer', () => {
      const computer = new Computer(
        'test-id',
        'TEST-PC',
        '192.168.1.100',
        'Windows 10',
        HealthStatus.HEALTHY,
        new Date(),
        5,
        10,
        'Default Group'
      );

      expect(computer.id).toBe('test-id');
      expect(computer.name).toBe('TEST-PC');
      expect(computer.status).toBe(HealthStatus.HEALTHY);
    });

    it('should throw error for empty ID', () => {
      expect(() => {
        new Computer(
          '',
          'TEST-PC',
          '192.168.1.100',
          'Windows 10',
          HealthStatus.HEALTHY,
          new Date(),
          0,
          0,
          'Default Group'
        );
      }).toThrow('Computer ID is required');
    });

    it('should throw error for negative updates needed', () => {
      expect(() => {
        new Computer(
          'test-id',
          'TEST-PC',
          '192.168.1.100',
          'Windows 10',
          HealthStatus.HEALTHY,
          new Date(),
          -1,
          0,
          'Default Group'
        );
      }).toThrow('Updates needed cannot be negative');
    });
  });

  describe('Business Logic', () => {
    it('should calculate compliance percentage correctly', () => {
      const computer = new Computer(
        'test-id',
        'TEST-PC',
        '192.168.1.100',
        'Windows 10',
        HealthStatus.HEALTHY,
        new Date(),
        5,
        10,
        'Default Group'
      );

      expect(computer.compliancePercentage).toBe(67); // 10 / 15 * 100 = 66.67 rounded
    });

    it('should return 100% compliance when no updates needed', () => {
      const computer = new Computer(
        'test-id',
        'TEST-PC',
        '192.168.1.100',
        'Windows 10',
        HealthStatus.HEALTHY,
        new Date(),
        0,
        10,
        'Default Group'
      );

      expect(computer.compliancePercentage).toBe(100);
    });

    it('should identify healthy computer', () => {
      const computer = new Computer(
        'test-id',
        'TEST-PC',
        '192.168.1.100',
        'Windows 10',
        HealthStatus.HEALTHY,
        new Date(),
        0,
        10,
        'Default Group'
      );

      expect(computer.isHealthy()).toBe(true);
    });

    it('should identify computer needing attention', () => {
      const computer = new Computer(
        'test-id',
        'TEST-PC',
        '192.168.1.100',
        'Windows 10',
        HealthStatus.CRITICAL,
        new Date(),
        10,
        0,
        'Default Group'
      );

      expect(computer.needsAttention()).toBe(true);
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON correctly', () => {
      const date = new Date('2024-01-01T00:00:00Z');
      const computer = new Computer(
        'test-id',
        'TEST-PC',
        '192.168.1.100',
        'Windows 10',
        HealthStatus.HEALTHY,
        date,
        5,
        10,
        'Default Group'
      );

      const json = computer.toJSON();
      expect(json.id).toBe('test-id');
      expect(json.name).toBe('TEST-PC');
      expect(json.lastSync).toBe(date.toISOString());
    });

    it('should deserialize from JSON correctly', () => {
      const json = {
        id: 'test-id',
        name: 'TEST-PC',
        ipAddress: '192.168.1.100',
        os: 'Windows 10',
        status: 'Healthy',
        lastSync: '2024-01-01T00:00:00.000Z',
        updatesNeeded: 5,
        updatesInstalled: 10,
        targetGroup: 'Default Group'
      };

      const computer = Computer.fromJSON(json);
      expect(computer.id).toBe('test-id');
      expect(computer.status).toBe(HealthStatus.HEALTHY);
      expect(computer.lastSync).toBeInstanceOf(Date);
    });
  });
});

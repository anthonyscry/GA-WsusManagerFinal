/**
 * Integration tests for RefreshTelemetryUseCase
 * Tests use case orchestration
 */

import { RefreshTelemetryUseCase } from '../../../application/use-cases/stats/RefreshTelemetryUseCase';
import { IStatsRepository } from '../../../domain/repositories/IStatsRepository';
import { IComputerRepository } from '../../../domain/repositories/IComputerRepository';
import { IWsusClient } from '../../../infrastructure/external/wsus/IWsusClient';
import { ISqlClient } from '../../../infrastructure/external/sql/ISqlClient';
import { ILogger } from '../../../infrastructure/logging/ILogger';
import { IEventBus } from '../../../application/events/IEventBus';
import { EnvironmentStats } from '../../../domain/entities/EnvironmentStats';
import { Computer } from '../../../domain/entities/Computer';
import { HealthStatus } from '../../../domain/value-objects/HealthStatus';
import { createDatabaseMetrics } from '../../../domain/value-objects/DatabaseMetrics';

// Mock implementations
class MockStatsRepository implements IStatsRepository {
  private stats = EnvironmentStats.empty();

  async get() {
    return this.stats;
  }

  async save(stats: EnvironmentStats) {
    this.stats = stats;
  }

  async clear() {
    this.stats = EnvironmentStats.empty();
  }
}

class MockComputerRepository implements IComputerRepository {
  private computers: Computer[] = [];

  async findAll() {
    return this.computers;
  }

  async findById(id: string) {
    return this.computers.find(c => c.id === id) || null;
  }

  async findByStatus(status: HealthStatus) {
    return this.computers.filter(c => c.status === status);
  }

  async findByTargetGroup(targetGroup: string) {
    return this.computers.filter(c => c.targetGroup === targetGroup);
  }

  async save(computer: Computer) {
    const index = this.computers.findIndex(c => c.id === computer.id);
    if (index >= 0) {
      this.computers[index] = computer;
    } else {
      this.computers.push(computer);
    }
  }

  async saveAll(computers: Computer[]) {
    this.computers = computers;
  }

  async delete(id: string) {
    this.computers = this.computers.filter(c => c.id !== id);
  }

  async count() {
    return this.computers.length;
  }

  async countByStatus(status: HealthStatus) {
    return this.computers.filter(c => c.status === status).length;
  }
}

class MockWsusClient implements IWsusClient {
  async initialize() {
    return true;
  }

  async getStats() {
    return new EnvironmentStats(
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
  }

  async getComputers() {
    return [
      new Computer('1', 'PC1', '192.168.1.1', 'Windows 10', HealthStatus.HEALTHY, new Date(), 0, 10, 'Group1'),
    ];
  }

  async forceComputerSync() {
    return true;
  }

  async performCleanup() {
    return true;
  }
}

class MockSqlClient implements ISqlClient {
  async getDatabaseMetrics() {
    return createDatabaseMetrics(5, 10, 'INSTANCE', 'C:\\Path', '2024-01-01');
  }

  async reindexDatabase() {
    return true;
  }
}

class MockLogger implements ILogger {
  info() {}
  warn() {}
  error() {}
  debug() {}
}

class MockEventBus implements IEventBus {
  private listeners: Map<string, Set<(data?: Record<string, unknown>) => void>> = new Map();

  subscribe(event: string, handler: (data?: Record<string, unknown>) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }

  unsubscribe(event: string, handler: (data?: Record<string, unknown>) => void) {
    this.listeners.get(event)?.delete(handler);
  }

  publish(event: string, data?: Record<string, unknown>) {
    this.listeners.get(event)?.forEach(handler => handler(data));
  }
}

describe('RefreshTelemetryUseCase', () => {
  it('should refresh telemetry successfully', async () => {
    const statsRepo = new MockStatsRepository();
    const computerRepo = new MockComputerRepository();
    const wsusClient = new MockWsusClient();
    const sqlClient = new MockSqlClient();
    const logger = new MockLogger();
    const eventBus = new MockEventBus();

    const useCase = new RefreshTelemetryUseCase(
      statsRepo,
      computerRepo,
      wsusClient,
      sqlClient,
      logger,
      eventBus
    );

    await useCase.execute();

    const stats = await statsRepo.get();
    expect(stats.totalComputers).toBe(10);
    expect(stats.isInstalled).toBe(true);
  });

  it('should handle WSUS client failure gracefully', async () => {
    const statsRepo = new MockStatsRepository();
    const computerRepo = new MockComputerRepository();
    const wsusClient = {
      ...new MockWsusClient(),
      getStats: async () => null, // Simulate failure
    } as IWsusClient;
    const sqlClient = new MockSqlClient();
    const logger = new MockLogger();
    const eventBus = new MockEventBus();

    const useCase = new RefreshTelemetryUseCase(
      statsRepo,
      computerRepo,
      wsusClient,
      sqlClient,
      logger,
      eventBus
    );

    // Should not throw, should handle gracefully
    await expect(useCase.execute()).resolves.not.toThrow();
  });
});

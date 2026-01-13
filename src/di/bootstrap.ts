import { Container } from './Container';
import { TOKENS } from './tokens';
import { LocalStorageAdapter } from '../infrastructure/persistence/storage';
import { LoggingServiceAdapter } from '../infrastructure/logging';
import { ProcessTerminalCommandUseCase } from '../application/use-cases/commands/ProcessTerminalCommandUseCase';
import {
  CommandHandler,
  StatusCommand,
  PingCommand,
  HelpCommand,
  ClearCommand,
  ReindexCommand,
  CleanupCommand
} from '../application/commands';
import { AddScheduledTaskUseCase, GetScheduledTasksUseCase } from '../application/use-cases/tasks';
import { ComputerRepository, StatsRepository, TaskRepository } from '../infrastructure/persistence/repositories';
import { WsusClientAdapter } from '../infrastructure/external/wsus';
import { SqlClientAdapter } from '../infrastructure/external/sql';
import { PowerShellExecutorAdapter } from '../infrastructure/external/powershell';
import { EventBus } from '../application/events';
import { JobManager } from '../application/jobs';
import {
  RefreshTelemetryUseCase,
  BulkSyncComputersUseCase,
  PerformCleanupUseCase,
  ReindexDatabaseUseCase
} from '../application/use-cases';

/**
 * Bootstrap Dependency Injection Container
 * Registers all services and their dependencies
 */
export function createContainer(): Container {
  const container = new Container();

  // Register infrastructure - storage
  container.registerSingleton(TOKENS.STORAGE, new LocalStorageAdapter());

  // Register infrastructure - logging
  container.registerSingleton(TOKENS.LOGGER, new LoggingServiceAdapter());

  // Register infrastructure - event bus
  container.registerSingleton(TOKENS.EVENT_BUS, new EventBus());

  // Register infrastructure - external services
  container.register(TOKENS.POWERSHELL_EXECUTOR, () =>
    new PowerShellExecutorAdapter(container.resolve(TOKENS.LOGGER))
  );

  container.register(TOKENS.WSUS_CLIENT, () =>
    new WsusClientAdapter(container.resolve(TOKENS.LOGGER))
  );

  container.register(TOKENS.SQL_CLIENT, () =>
    new SqlClientAdapter(container.resolve(TOKENS.LOGGER))
  );

  // Register repositories
  container.register(TOKENS.COMPUTER_REPOSITORY, () =>
    new ComputerRepository(
      container.resolve(TOKENS.STORAGE),
      container.resolve(TOKENS.LOGGER)
    )
  );

  container.register(TOKENS.STATS_REPOSITORY, () =>
    new StatsRepository(
      container.resolve(TOKENS.STORAGE),
      container.resolve(TOKENS.LOGGER)
    )
  );

  container.register(TOKENS.TASK_REPOSITORY, () =>
    new TaskRepository(
      container.resolve(TOKENS.STORAGE),
      container.resolve(TOKENS.LOGGER)
    )
  );

  // Register application services
  container.register(TOKENS.JOB_MANAGER, () =>
    new JobManager(
      container.resolve(TOKENS.EVENT_BUS),
      container.resolve(TOKENS.LOGGER)
    )
  );

  // Register use cases
  container.register(TOKENS.REFRESH_TELEMETRY_USE_CASE, () =>
    new RefreshTelemetryUseCase(
      container.resolve(TOKENS.STATS_REPOSITORY),
      container.resolve(TOKENS.COMPUTER_REPOSITORY),
      container.resolve(TOKENS.WSUS_CLIENT),
      container.resolve(TOKENS.SQL_CLIENT),
      container.resolve(TOKENS.LOGGER),
      container.resolve(TOKENS.EVENT_BUS)
    )
  );

  container.register(TOKENS.BULK_SYNC_COMPUTERS_USE_CASE, () =>
    new BulkSyncComputersUseCase(
      container.resolve(TOKENS.COMPUTER_REPOSITORY),
      container.resolve(TOKENS.WSUS_CLIENT),
      container.resolve(TOKENS.JOB_MANAGER),
      container.resolve(TOKENS.LOGGER)
    )
  );

  container.register(TOKENS.PERFORM_CLEANUP_USE_CASE, () =>
    new PerformCleanupUseCase(
      container.resolve(TOKENS.STATS_REPOSITORY),
      container.resolve(TOKENS.WSUS_CLIENT),
      container.resolve(TOKENS.SQL_CLIENT),
      container.resolve(TOKENS.JOB_MANAGER),
      container.resolve(TOKENS.LOGGER)
    )
  );

  container.register(TOKENS.REINDEX_DATABASE_USE_CASE, () =>
    new ReindexDatabaseUseCase(
      container.resolve(TOKENS.SQL_CLIENT),
      container.resolve(TOKENS.JOB_MANAGER),
      container.resolve(TOKENS.LOGGER)
    )
  );

  // Register command handler and commands
  container.register(TOKENS.COMMAND_HANDLER, () => {
    const handler = new CommandHandler();
    
    // Register commands
    handler.register(new StatusCommand(container.resolve(TOKENS.STATS_REPOSITORY)));
    handler.register(new PingCommand());
    handler.register(new HelpCommand(handler));
    handler.register(new ClearCommand(container.resolve(TOKENS.LOGGER) as LoggingServiceAdapter));
    handler.register(new ReindexCommand(container.resolve(TOKENS.REINDEX_DATABASE_USE_CASE)));
    handler.register(new CleanupCommand(container.resolve(TOKENS.PERFORM_CLEANUP_USE_CASE)));
    
    return handler;
  });

  // Register command use case
  container.register(TOKENS.PROCESS_TERMINAL_COMMAND_USE_CASE, () =>
    new ProcessTerminalCommandUseCase(
      container.resolve(TOKENS.COMMAND_HANDLER),
      container.resolve(TOKENS.LOGGER)
    )
  );

  // Register task use cases
  container.register(TOKENS.ADD_SCHEDULED_TASK_USE_CASE, () =>
    new AddScheduledTaskUseCase(
      container.resolve(TOKENS.TASK_REPOSITORY),
      container.resolve(TOKENS.LOGGER)
    )
  );

  container.register(TOKENS.GET_SCHEDULED_TASKS_USE_CASE, () =>
    new GetScheduledTasksUseCase(
      container.resolve(TOKENS.TASK_REPOSITORY)
    )
  );

  return container;
}

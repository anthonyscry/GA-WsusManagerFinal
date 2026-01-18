/**
 * @deprecated StateService is deprecated. Use the new architecture hooks instead:
 * - useStats() - for environment statistics
 * - useComputers() - for computer inventory
 * - useJobs() - for background jobs
 * - useRefreshTelemetry() - for refreshing data
 * - useBulkSync() - for bulk computer operations
 * - useMaintenance() - for maintenance operations
 * - useScheduledTasks() - for scheduled tasks
 * - useTerminalCommand() - for terminal commands
 * 
 * See docs/refactoring/MIGRATION_GUIDE.md for migration instructions.
 * 
 * This file re-exports from the modularized services/state/ directory.
 */

export { stateService, type BackgroundJob } from './state';

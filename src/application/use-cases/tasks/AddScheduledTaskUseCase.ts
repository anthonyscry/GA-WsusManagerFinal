import { ITaskRepository } from '../../../domain/repositories/ITaskRepository';
import { ScheduledTask } from '../../../domain/entities/ScheduledTask';
import { ILogger } from '../../../infrastructure/logging/ILogger';
import { ValidationError } from '../../../domain/errors/ValidationError';
import { IPowerShellExecutor } from '../../../infrastructure/external/powershell/IPowerShellExecutor';

/**
 * Add Scheduled Task Use Case
 * Creates a new scheduled task in Windows Task Scheduler and persists to repository
 */
export class AddScheduledTaskUseCase {
  constructor(
    private readonly taskRepo: ITaskRepository,
    private readonly logger: ILogger,
    private readonly powershell?: IPowerShellExecutor
  ) {}

  async execute(input: {
    name: string;
    trigger: 'Daily' | 'Weekly' | 'Monthly';
    time: string;
  }): Promise<ScheduledTask> {
    // Validate input
    if (!input.name || input.name.trim().length === 0) {
      throw new ValidationError('Task name is required', 'name');
    }

    if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(input.time)) {
      throw new ValidationError('Time must be in HH:MM format', 'time');
    }

    // Sanitize task name for safe use in PowerShell
    const safeName = input.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    
    // Execute PowerShell to register the task in Windows Task Scheduler
    if (this.powershell) {
      const scriptPath = 'C:\\WSUS\\Scripts\\Invoke-WsusMonthlyMaintenance.ps1';
      
      // Build the PowerShell command to register the scheduled task
      const triggerParam = input.trigger === 'Daily' ? '-Daily' : 
                          input.trigger === 'Weekly' ? '-Weekly -DaysOfWeek Monday' : 
                          '-Monthly -DaysOfMonth 1';
      
      const psCommand = `
        $ErrorActionPreference = 'Stop'
        
        # Check if task already exists
        $existingTask = Get-ScheduledTask -TaskName "${safeName}" -ErrorAction SilentlyContinue
        if ($existingTask) {
          Unregister-ScheduledTask -TaskName "${safeName}" -Confirm:$false
          Write-Output "Removed existing task: ${safeName}"
        }
        
        # Create the trigger
        $trigger = New-ScheduledTaskTrigger ${triggerParam} -At "${input.time}"
        
        # Create the action
        $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"'
        
        # Create principal to run as SYSTEM with highest privileges
        $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
        
        # Create settings
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable:$false
        
        # Register the task
        Register-ScheduledTask -TaskName "${safeName}" -Trigger $trigger -Action $action -Principal $principal -Settings $settings -Description "WSUS automated maintenance task created by GA-WsusManager Pro"
        
        Write-Output "SUCCESS: Task '${safeName}' registered in Windows Task Scheduler"
        
        # Get next run time
        $task = Get-ScheduledTask -TaskName "${safeName}"
        $taskInfo = Get-ScheduledTaskInfo -TaskName "${safeName}"
        $nextRun = if ($taskInfo.NextRunTime) { $taskInfo.NextRunTime.ToString("yyyy-MM-dd HH:mm") } else { "Pending" }
        Write-Output "NEXT_RUN:$nextRun"
      `;
      
      try {
        this.logger.info(`[TASK-SCHEDULER] Registering task: ${safeName}`);
        const result = await this.powershell.execute(psCommand, 30000);
        
        if (!result.success) {
          this.logger.error(`[TASK-SCHEDULER] Failed to register task: ${result.stderr}`);
          throw new Error(`Failed to register scheduled task: ${result.stderr || 'Unknown error'}`);
        }
        
        this.logger.info(`[TASK-SCHEDULER] Task registered successfully: ${safeName}`);
        this.logger.info(result.stdout);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`[TASK-SCHEDULER] Error: ${errorMsg}`);
        throw error;
      }
    } else {
      this.logger.warn('[TASK-SCHEDULER] PowerShell executor not available - task saved to local state only');
    }

    // Generate ID
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    const id = Array.from(array, byte => byte.toString(36)).join('').slice(0, 11);

    // Calculate next run time
    const now = new Date();
    const [hours, minutes] = input.time.split(':').map(Number);
    const nextRun = new Date(now);
    nextRun.setHours(hours, minutes, 0, 0);
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    const nextRunStr = nextRun.toISOString().slice(0, 16).replace('T', ' ');

    const task = new ScheduledTask(
      id,
      safeName,
      input.trigger,
      input.time,
      'Ready',
      'Never',
      nextRunStr
    );

    await this.taskRepo.save(task);
    this.logger.info(`Scheduled task created and saved: ${task.name}`);

    return task;
  }
}

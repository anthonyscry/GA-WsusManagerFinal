/**
 * PowerShell Executor Interface
 * Defines contract for PowerShell script execution
 */
export interface IPowerShellExecutor {
  /**
   * Execute PowerShell command
   */
  execute(script: string): Promise<{
    success: boolean;
    stdout?: string;
    stderr?: string;
  }>;

  /**
   * Check if module is available
   */
  checkModule(moduleName: string): Promise<boolean>;

  /**
   * Import PowerShell module
   */
  importModule(moduleName: string): Promise<boolean>;
}

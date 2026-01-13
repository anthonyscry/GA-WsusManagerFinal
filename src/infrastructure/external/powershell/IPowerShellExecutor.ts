/**
 * PowerShell Executor Interface
 * Defines contract for PowerShell script execution
 */
export interface IPowerShellExecutor {
  /**
   * Execute PowerShell command
   * @param script The PowerShell script to execute
   * @param timeout Optional timeout in milliseconds (default: 30000)
   */
  execute(script: string, timeout?: number): Promise<{
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

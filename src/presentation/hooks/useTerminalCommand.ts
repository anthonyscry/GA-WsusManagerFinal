import { useState, useCallback } from 'react';
import { useService } from '../context/ServiceContext';
import { TOKENS } from '../../di/tokens';
import { ProcessTerminalCommandUseCase } from '../../application/use-cases/commands/ProcessTerminalCommandUseCase';

/**
 * Hook for processing terminal commands
 */
export function useTerminalCommand() {
  const useCase = useService<ProcessTerminalCommandUseCase>(TOKENS.PROCESS_TERMINAL_COMMAND_USE_CASE);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async (command: string): Promise<string | null> => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const result = await useCase.execute(command);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [useCase]);

  return {
    execute,
    isProcessing,
    error
  };
}

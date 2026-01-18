import { useState, useEffect, useCallback } from 'react';
import { useService } from '../context/ServiceContext';
import { TOKENS } from '../../di/tokens';
import { ScheduledTask } from '../../domain/entities/ScheduledTask';
import { AddScheduledTaskUseCase } from '../../application/use-cases/tasks/AddScheduledTaskUseCase';
import { GetScheduledTasksUseCase } from '../../application/use-cases/tasks/GetScheduledTasksUseCase';

/**
 * Hook for managing scheduled tasks
 */
export function useScheduledTasks() {
  const addTaskUseCase = useService<AddScheduledTaskUseCase>(TOKENS.ADD_SCHEDULED_TASK_USE_CASE);
  const getTasksUseCase = useService<GetScheduledTasksUseCase>(TOKENS.GET_SCHEDULED_TASKS_USE_CASE);
  
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const loadedTasks = await getTasksUseCase.execute();
      setTasks(loadedTasks);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load tasks');
      setError(error);
    } finally {
      setIsLoading(false);
    }
  }, [getTasksUseCase]);

  const addTask = useCallback(async (input: {
    name: string;
    trigger: 'Daily' | 'Weekly' | 'Monthly';
    time: string;
    dayOfMonth?: number;
    daysOfWeek?: string[];
  }) => {
    setError(null);
    
    try {
      const newTask = await addTaskUseCase.execute(input);
      setTasks(prev => [...prev, newTask]);
      return newTask;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to add task');
      setError(error);
      throw error;
    }
  }, [addTaskUseCase]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  return {
    tasks,
    isLoading,
    error,
    addTask,
    refresh: loadTasks
  };
}

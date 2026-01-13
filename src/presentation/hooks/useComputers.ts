import { useState, useEffect } from 'react';
import { useService } from '../context/ServiceContext';
import { TOKENS } from '../../di/tokens';
import { IComputerRepository } from '../../domain/repositories/IComputerRepository';
import { Computer } from '../../domain/entities/Computer';
import { IEventBus } from '../../application/events/IEventBus';
import { WsusComputer } from '../../../types';

/**
 * Convert domain Computer entity to WsusComputer interface
 */
function toWsusComputer(computer: Computer): WsusComputer {
  return {
    id: computer.id,
    name: computer.name,
    ipAddress: computer.ipAddress,
    os: computer.os,
    status: computer.status,
    lastSync: computer.lastSync.toISOString(),
    updatesNeeded: computer.updatesNeeded,
    updatesInstalled: computer.updatesInstalled,
    targetGroup: computer.targetGroup
  };
}

/**
 * Hook for accessing computer inventory
 * Subscribes to updates via event bus
 */
export function useComputers() {
  const computerRepository = useService<IComputerRepository>(TOKENS.COMPUTER_REPOSITORY);
  const eventBus = useService<IEventBus>(TOKENS.EVENT_BUS);
  const [computers, setComputers] = useState<WsusComputer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load initial computers
    const loadComputers = async () => {
      setIsLoading(true);
      try {
        const data = await computerRepository.findAll();
        setComputers(data.map(toWsusComputer));
      } catch (error) {
        console.error('Failed to load computers', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadComputers();

    // Subscribe to computer updates
    const unsubscribe = eventBus.subscribe('computers.updated', async () => {
      const data = await computerRepository.findAll();
      setComputers(data.map(toWsusComputer));
    });

    return unsubscribe;
  }, [computerRepository, eventBus]);

  return {
    computers,
    isLoading
  };
}

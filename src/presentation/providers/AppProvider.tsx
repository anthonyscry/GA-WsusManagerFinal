import React, { ReactNode } from 'react';
import { ServiceProvider } from '../context/ServiceContext';
import { createContainer } from '../../di/bootstrap';
import { stateServiceBridge } from '../../bridge/StateServiceBridge';

interface AppProviderProps {
  children: ReactNode;
}

/**
 * App Provider Component
 * Bootstraps the application with DI container and initializes bridge
 */
export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const container = React.useMemo(() => {
    const c = createContainer();
    // Initialize bridge to allow gradual migration
    stateServiceBridge.initialize(c);
    return c;
  }, []);

  return (
    <ServiceProvider container={container}>
      {children}
    </ServiceProvider>
  );
};

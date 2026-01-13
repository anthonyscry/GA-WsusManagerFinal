import React, { createContext, useContext, ReactNode } from 'react';
import { Container } from '../../di/Container';

const ServiceContext = createContext<Container | null>(null);

interface ServiceProviderProps {
  container: Container;
  children: ReactNode;
}

/**
 * Service Provider Component
 * Provides DI container to React component tree
 */
export const ServiceProvider: React.FC<ServiceProviderProps> = ({
  container,
  children
}) => {
  return (
    <ServiceContext.Provider value={container}>
      {children}
    </ServiceContext.Provider>
  );
};

/**
 * Hook to access services from DI container
 */
export function useService<T>(token: string): T {
  const container = useContext(ServiceContext);
  
  if (!container) {
    throw new Error(
      'useService must be used within a ServiceProvider. ' +
      'Wrap your app with <ServiceProvider container={container}>'
    );
  }
  
  return container.resolve<T>(token);
}

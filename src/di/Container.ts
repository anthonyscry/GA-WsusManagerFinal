/**
 * Dependency Injection Container
 * Simple container for managing service dependencies
 */
export class Container {
  private services = new Map<string, any>();
  private factories = new Map<string, () => any>();

  /**
   * Register a factory function
   */
  register<T>(token: string, factory: () => T): void {
    this.factories.set(token, factory);
  }

  /**
   * Register a singleton instance
   */
  registerSingleton<T>(token: string, instance: T): void {
    this.services.set(token, instance);
  }

  /**
   * Resolve a service by token
   */
  resolve<T>(token: string): T {
    // Check if already instantiated
    if (this.services.has(token)) {
      return this.services.get(token);
    }

    // Check if factory exists
    if (this.factories.has(token)) {
      const instance = this.factories.get(token)!();
      // Cache as singleton
      this.services.set(token, instance);
      return instance;
    }

    throw new Error(`Service not found: ${token}`);
  }

  /**
   * Check if service is registered
   */
  has(token: string): boolean {
    return this.services.has(token) || this.factories.has(token);
  }

  /**
   * Clear all services (useful for testing)
   */
  clear(): void {
    this.services.clear();
    this.factories.clear();
  }
}

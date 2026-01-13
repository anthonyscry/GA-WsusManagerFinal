/**
 * Event Bus Interface
 * Defines contract for event publishing and subscription
 */
export interface IEventBus {
  /**
   * Publish an event
   */
  publish(event: string, data?: Record<string, unknown>): void;

  /**
   * Subscribe to an event
   */
  subscribe(event: string, handler: (data?: Record<string, unknown>) => void): () => void;

  /**
   * Unsubscribe from an event
   */
  unsubscribe(event: string, handler: (data?: Record<string, unknown>) => void): void;
}

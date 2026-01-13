import { IEventBus } from './IEventBus';

/**
 * Simple Event Bus Implementation
 * Uses observer pattern for event communication
 */
export class EventBus implements IEventBus {
  private handlers = new Map<string, Set<(data?: Record<string, unknown>) => void>>();

  publish(event: string, data?: Record<string, unknown>): void {
    const eventHandlers = this.handlers.get(event);
    if (!eventHandlers) return;

    eventHandlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
  }

  subscribe(event: string, handler: (data?: Record<string, unknown>) => void): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }

    this.handlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.unsubscribe(event, handler);
    };
  }

  unsubscribe(event: string, handler: (data?: Record<string, unknown>) => void): void {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      eventHandlers.delete(handler);
      if (eventHandlers.size === 0) {
        this.handlers.delete(event);
      }
    }
  }
}

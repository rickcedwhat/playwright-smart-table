type Listener<T = unknown> = (data: T) => void;

/**
 * Minimal typed event emitter for internal use.
 */
export class EventEmitter<Events extends Record<string, unknown>> {
  private listeners = new Map<keyof Events, Set<Listener<unknown>>>();

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as Listener<unknown>);
  }

  off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener as Listener<unknown>);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  emit<K extends keyof Events>(event: K, data: Events[K]): void {
    this.listeners.get(event)?.forEach(fn => fn(data));
  }
}

// Quick helper — attach a one-time listener
export function once<Events extends Record<string, unknown>, K extends keyof Events>(
  emitter: EventEmitter<Events>,
  event: K,
  callback: (data: Events[K]) => void,
): void {
  const wrapper = (data: Events[K]): void => {
    callback(data);
    emitter.off(event, wrapper);
  };
  emitter.on(event, wrapper);
}

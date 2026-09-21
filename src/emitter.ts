/** Minimal dependency-free EventEmitter (works in both Node and browsers). */
export class SimpleEmitter<Events extends Record<string, unknown>> {
  private listeners: { [K in keyof Events]?: Array<(payload: Events[K]) => void> } = {};

  on<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void): this {
    (this.listeners[event] ??= []).push(handler);
    return this;
  }

  off<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void): this {
    this.listeners[event] = this.listeners[event]?.filter((h) => h !== handler);
    return this;
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    for (const handler of this.listeners[event] ?? []) handler(payload);
  }
}

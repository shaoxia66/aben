export type DomainEvent<TType extends string = string, TPayload = unknown> = {
  type: TType;
  occurredAtMs: number;
  payload: TPayload;
};

export type DomainEventHandler<TEvent extends DomainEvent = DomainEvent> = (
  event: TEvent
) => void | Promise<void>;

export class InMemoryEventBus {
  private readonly handlersByType = new Map<string, Set<DomainEventHandler>>();

  subscribe<TEvent extends DomainEvent>(
    eventType: TEvent["type"],
    handler: DomainEventHandler<TEvent>
  ) {
    const type = String(eventType);
    let handlers = this.handlersByType.get(type);
    if (!handlers) {
      handlers = new Set();
      this.handlersByType.set(type, handlers);
    }

    handlers.add(handler as DomainEventHandler);
    return () => {
      handlers?.delete(handler as DomainEventHandler);
      if (handlers && handlers.size === 0) this.handlersByType.delete(type);
    };
  }

  async publish<TEvent extends DomainEvent>(event: TEvent) {
    const handlers = this.handlersByType.get(String(event.type));
    if (!handlers || handlers.size === 0) return;

    await Promise.allSettled(Array.from(handlers).map((handler) => handler(event)));
  }
}

export const eventBus = new InMemoryEventBus();


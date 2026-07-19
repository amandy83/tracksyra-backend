import type { DistributionDomainEvent, EventPublisher as EventPublisherPort } from "../../domain";
import type { DocumentStore } from "../shared/documentStore";

export type DomainEventHandler<TEvent extends DistributionDomainEvent = DistributionDomainEvent> = (
  event: TEvent,
) => Promise<void> | void;

export class EventDispatcher {
  private readonly handlers = new Map<string, Set<DomainEventHandler>>();

  register<TEvent extends DistributionDomainEvent["type"]>(
    eventType: TEvent | "*",
    handler: DomainEventHandler<Extract<DistributionDomainEvent, { type: TEvent }>>,
  ): void {
    const existing = this.handlers.get(eventType) ?? new Set<DomainEventHandler>();
    existing.add(handler as DomainEventHandler);
    this.handlers.set(eventType, existing);
  }

  unregister<TEvent extends DistributionDomainEvent["type"]>(
    eventType: TEvent | "*",
    handler: DomainEventHandler<Extract<DistributionDomainEvent, { type: TEvent }>>,
  ): void {
    this.handlers.get(eventType)?.delete(handler as DomainEventHandler);
  }

  async dispatch(event: DistributionDomainEvent): Promise<void> {
    const handlers = new Set<DomainEventHandler>([
      ...(this.handlers.get("*") ?? []),
      ...(this.handlers.get(event.type) ?? []),
    ]);
    for (const handler of handlers) {
      await handler(event);
    }
  }
}

export class DomainEventBus {
  private readonly history: DistributionDomainEvent[] = [];

  constructor(
    private readonly dispatcher: EventDispatcher,
    private readonly eventStore: DocumentStore | null = null,
  ) {}

  register<TEvent extends DistributionDomainEvent["type"]>(
    eventType: TEvent | "*",
    handler: DomainEventHandler<Extract<DistributionDomainEvent, { type: TEvent }>>,
  ): void {
    this.dispatcher.register(eventType, handler);
  }

  async publish(event: DistributionDomainEvent): Promise<void> {
    this.history.push(event);
    if (this.eventStore) {
      await this.eventStore.write(this.eventKey(event), event);
    }
    await this.dispatcher.dispatch(event);
  }

  get events(): readonly DistributionDomainEvent[] {
    return [...this.history];
  }

  private eventKey(event: DistributionDomainEvent): string {
    const aggregateType = event.aggregateType.replace(/[^A-Za-z0-9._-]/g, "_");
    const aggregateId = event.aggregateId.replace(/[^A-Za-z0-9._-]/g, "_");
    return `events/${aggregateType}/${aggregateId}/${event.occurredAt}-${event.type}.json`;
  }
}

export class EventPublisher implements EventPublisherPort<DistributionDomainEvent> {
  constructor(private readonly bus: DomainEventBus) {}

  publish(event: DistributionDomainEvent): Promise<void> {
    return this.bus.publish(event);
  }
}

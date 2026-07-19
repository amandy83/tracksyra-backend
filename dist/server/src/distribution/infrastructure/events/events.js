export class EventDispatcher {
    handlers = new Map();
    register(eventType, handler) {
        const existing = this.handlers.get(eventType) ?? new Set();
        existing.add(handler);
        this.handlers.set(eventType, existing);
    }
    unregister(eventType, handler) {
        this.handlers.get(eventType)?.delete(handler);
    }
    async dispatch(event) {
        const handlers = new Set([
            ...(this.handlers.get("*") ?? []),
            ...(this.handlers.get(event.type) ?? []),
        ]);
        for (const handler of handlers) {
            await handler(event);
        }
    }
}
export class DomainEventBus {
    dispatcher;
    eventStore;
    history = [];
    constructor(dispatcher, eventStore = null) {
        this.dispatcher = dispatcher;
        this.eventStore = eventStore;
    }
    register(eventType, handler) {
        this.dispatcher.register(eventType, handler);
    }
    async publish(event) {
        this.history.push(event);
        if (this.eventStore) {
            await this.eventStore.write(this.eventKey(event), event);
        }
        await this.dispatcher.dispatch(event);
    }
    get events() {
        return [...this.history];
    }
    eventKey(event) {
        const aggregateType = event.aggregateType.replace(/[^A-Za-z0-9._-]/g, "_");
        const aggregateId = event.aggregateId.replace(/[^A-Za-z0-9._-]/g, "_");
        return `events/${aggregateType}/${aggregateId}/${event.occurredAt}-${event.type}.json`;
    }
}
export class EventPublisher {
    bus;
    constructor(bus) {
        this.bus = bus;
    }
    publish(event) {
        return this.bus.publish(event);
    }
}

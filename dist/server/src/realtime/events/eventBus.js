export class EventBus {
    store;
    handlers = new Set();
    constructor(store) {
        this.store = store;
    }
    subscribe(handler) {
        this.handlers.add(handler);
        return () => this.handlers.delete(handler);
    }
    async publish(event) {
        const published = await this.store.appendEvent(this.sanitize(event));
        await Promise.all([...this.handlers].map((handler) => handler(published)));
        return published;
    }
    async replay(channel, sinceSequence = 0, limit = 100) {
        return this.store.replayChannel(channel, sinceSequence, limit);
    }
    sanitize(event) {
        return {
            ...event,
            payload: sanitizePayload(event.payload),
            channels: [...new Set(event.channels)],
        };
    }
}
function sanitizePayload(payload) {
    const blocked = new Set(["access_token", "refresh_token", "password", "raw_payload", "raw_event"]);
    return Object.fromEntries(Object.entries(payload).filter(([key]) => !blocked.has(key.toLowerCase())));
}

export class BaseRealtimePublisher {
    eventBus;
    constructor(eventBus) {
        this.eventBus = eventBus;
    }
    publish(input) {
        const channels = input.channels ?? this.buildChannels(input);
        return this.eventBus.publish({
            ...input,
            channels,
            occurred_at: new Date().toISOString(),
        });
    }
    eventId(type, id) {
        return `realtime:${type}:${id}`;
    }
    buildChannels(input) {
        const channels = [];
        if (input.artist_id)
            channels.push(`artist:${input.artist_id}`);
        if (input.track_id)
            channels.push(`track:${input.track_id}`);
        if (input.release_id)
            channels.push(`release:${input.release_id}`);
        if (input.platform)
            channels.push(`platform:${input.platform}`);
        if (input.entity_type === "payout")
            channels.push(`payout:${input.entity_id}`);
        return channels;
    }
}

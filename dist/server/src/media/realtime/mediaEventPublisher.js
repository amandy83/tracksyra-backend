export class MediaEventPublisher {
    publisher;
    constructor(publisher) {
        this.publisher = publisher;
    }
    publish(input) {
        return this.publisher.publish({
            event_id: `realtime:${input.type}:${input.assetId}`,
            event_type: input.type,
            entity_type: input.trackId ? "track" : "release",
            entity_id: input.trackId || input.releaseId || input.assetId,
            artist_id: input.artistId,
            track_id: input.trackId,
            release_id: input.releaseId,
            sequence_key: input.trackId ? `track:${input.trackId}` : `media:${input.assetId}`,
            payload: { asset_id: input.assetId, ...(input.payload || {}) },
        });
    }
}

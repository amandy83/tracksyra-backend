export class StreamingIngestionEngine {
    deps;
    providers;
    constructor(deps) {
        this.deps = deps;
        this.providers = new Map(deps.providers.map((provider) => [provider.provider, provider]));
    }
    async ingestRealtime(input) {
        const provider = this.getProvider(input.provider);
        const events = await provider.fetchRealtimeStreams(input);
        return this.ingestEvents({
            provider: provider.provider,
            mode: "REALTIME",
            events,
            batchId: this.buildBatchId(provider.provider, "REALTIME", events),
        });
    }
    async ingestDailyBatch(input) {
        const provider = this.getProvider(input.provider);
        const events = await provider.fetchDailyStreams(input);
        return this.ingestEvents({
            provider: provider.provider,
            mode: "DAILY_BATCH",
            events,
            batchId: this.buildBatchId(provider.provider, "DAILY_BATCH", events),
        });
    }
    async ingestEvents(input) {
        const provider = this.getProvider(input.provider);
        const normalized = input.events.map((event) => {
            if (!provider.validatePayload(event))
                throw new Error(`Invalid stream payload for provider ${input.provider}`);
            return this.normalizeEvent(event, provider.provider, input.mode);
        });
        return this.deps.processingEngine.processEvents({
            batchId: input.batchId ?? this.buildBatchId(provider.provider, input.mode, normalized),
            provider: provider.provider,
            events: normalized,
        });
    }
    normalizeEvent(event, provider, mode) {
        return {
            event_id: event.event_id,
            track_id: event.track_id,
            platform: event.platform,
            stream_count_increment: event.stream_count_increment,
            listener_country: event.listener_country.toUpperCase(),
            timestamp: new Date(event.timestamp).toISOString(),
            provider,
            ingestion_mode: mode,
            received_at: new Date().toISOString(),
            raw_payload: event,
        };
    }
    getProvider(providerName) {
        const provider = this.providers.get(providerName);
        if (!provider)
            throw new Error(`Stream provider not registered: ${providerName}`);
        return provider;
    }
    buildBatchId(provider, mode, events) {
        const ids = events.map((event) => event.event_id).sort().join(",");
        return `stream-batch:${provider}:${mode}:${hash(ids)}`;
    }
}
function hash(value) {
    let hashValue = 0;
    for (let index = 0; index < value.length; index += 1) {
        hashValue = ((hashValue << 5) - hashValue + value.charCodeAt(index)) | 0;
    }
    return Math.abs(hashValue).toString(36);
}

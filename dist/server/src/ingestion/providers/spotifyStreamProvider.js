import { buildMockStreamEvents } from "./mockStreamData.js";
import { isValidStreamEvent } from "./streamProvider.js";
export class SpotifyStreamProvider {
    provider = "spotify";
    async fetchDailyStreams(input) {
        return buildMockStreamEvents({ provider: this.provider, platform: "spotify", trackIds: input.trackIds, from: input.from });
    }
    async fetchRealtimeStreams(input) {
        return buildMockStreamEvents({
            provider: this.provider,
            platform: "spotify",
            trackIds: input.trackIds,
            from: input.from,
            realtime: true,
        });
    }
    validatePayload(payload) {
        return isValidStreamEvent(payload);
    }
}

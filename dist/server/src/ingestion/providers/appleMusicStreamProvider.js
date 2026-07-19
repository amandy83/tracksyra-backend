import { buildMockStreamEvents } from "./mockStreamData.js";
import { isValidStreamEvent } from "./streamProvider.js";
export class AppleMusicStreamProvider {
    provider = "apple_music";
    async fetchDailyStreams(input) {
        return buildMockStreamEvents({ provider: this.provider, platform: "apple_music", trackIds: input.trackIds, from: input.from });
    }
    async fetchRealtimeStreams(input) {
        return buildMockStreamEvents({
            provider: this.provider,
            platform: "apple_music",
            trackIds: input.trackIds,
            from: input.from,
            realtime: true,
        });
    }
    validatePayload(payload) {
        return isValidStreamEvent(payload);
    }
}

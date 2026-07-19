export class DomainEventSubscriber {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async onStreamAccepted(event) {
        const artistId = await this.deps.resolveArtistIdForTrack?.(event.track_id);
        await this.deps.streamPublisher.publishStreamReceived(event, artistId ?? null);
    }
    async onFraudScored(event, score) {
        if (score.decision !== "CLEAN") {
            await this.deps.fraudPublisher.publishFraudFlagged(event, score);
        }
    }
    async onDistributionStatusChanged(input) {
        await this.deps.distributionPublisher.publishDistributionStatusChanged(input);
    }
}

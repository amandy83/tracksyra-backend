import { ReconciliationResult } from "./reconciliation/reconciliationResult.js";
import { StatusTransition } from "./types/statusTypes.js";
import { ReleaseId } from "../domain/index.js";
function normalizeRawStatus(snapshot, webhook, polling) {
    return webhook?.providerStatusEvent.providerStatus ?? polling?.snapshot.current.rawStatus ?? snapshot.current.rawStatus;
}
function normalizeSource(webhook, polling) {
    return webhook ? "WEBHOOK" : "POLLING";
}
export class DistributionStatusSyncEngineBridge {
    orchestrator;
    constructor(orchestrator) {
        this.orchestrator = orchestrator;
    }
    async synchronize(input) {
        const source = normalizeSource(input.webhook, input.polling);
        const rawStatus = normalizeRawStatus(input.snapshot, input.webhook, input.polling);
        const normalizedStatus = input.snapshot.current;
        const transition = new StatusTransition({
            releaseId: input.snapshot.releaseId,
            from: input.snapshot.previous?.canonicalState ?? null,
            to: normalizedStatus.canonicalState,
            source,
            reason: rawStatus,
            metadata: {
                providerReference: input.snapshot.providerReference,
                providerStatus: rawStatus,
            },
        });
        await this.orchestrator.syncStatus({
            releaseId: new ReleaseId(input.snapshot.releaseId),
            requestedBy: source.toLowerCase(),
        });
        return new ReconciliationResult({
            releaseId: input.snapshot.releaseId,
            success: true,
            snapshot: input.snapshot,
            normalizedStatus: normalizedStatus,
            transition,
            conflictResolution: null,
            warnings: [],
            errors: [],
            reconciledAt: new Date().toISOString(),
            metadata: {
                source,
            },
        });
    }
}

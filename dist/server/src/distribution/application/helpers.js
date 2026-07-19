import { SubmissionLock } from "../domain/index.js";
import { DomainInvariantError } from "../domain/index.js";
export function createDomainEvent(event) {
    return event;
}
export function eventMeta(aggregateId, aggregateType, type, payload, version = 1) {
    return {
        type,
        aggregateId,
        aggregateType,
        occurredAt: new Date().toISOString(),
        version,
        payload,
    };
}
export async function publishMany(publisher, events) {
    for (const event of events) {
        await Promise.resolve(publisher.publish(event));
    }
}
export function releaseIdValue(release) {
    return release.release.id.value;
}
export function requireReleaseState(release, expected) {
    if (!expected.includes(release.release.state)) {
        throw new DomainInvariantError("Release is not in the expected state", {
            releaseId: release.release.id.value,
            currentState: release.release.state,
            expected,
        });
    }
}
export function mapProviderStatusToState(status) {
    switch (status.value) {
        case "AUTHENTICATING":
            return "AUTHENTICATING_PROVIDER";
        case "UPLOADING":
            return "UPLOAD_IN_PROGRESS";
        case "PROCESSING":
            return "PROVIDER_PROCESSING";
        case "ACCEPTED":
            return "DSP_ACCEPTED";
        case "LIVE":
            return "DSP_LIVE";
        case "REJECTED":
            return "REJECTED";
        case "FAILED":
            return "REJECTED";
        case "CANCELLED":
            return "CANCELLED";
        case "TAKEDOWN_PENDING":
            return "TAKEDOWN_PENDING";
        case "TAKEDOWN_COMPLETED":
            return "TAKEDOWN_COMPLETED";
        case "PENDING":
        default:
            return "PROVIDER_PROCESSING";
    }
}
export function createSubmissionLock(releaseId, requestedBy, key) {
    return new SubmissionLock({
        token: `${releaseId}:${key}`,
        owner: requestedBy,
    });
}

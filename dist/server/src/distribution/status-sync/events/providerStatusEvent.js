import { StatusEvidence } from "../types/statusTypes.js";
export class ProviderStatusEvent {
    eventId;
    releaseId;
    providerReference;
    providerStatus;
    source;
    receivedAt;
    headers;
    payload;
    signatureValid;
    metadata;
    constructor(input) {
        this.eventId = input.eventId.trim();
        this.releaseId = input.releaseId.trim();
        this.providerReference = input.providerReference.trim();
        this.providerStatus = input.providerStatus.trim();
        this.source = input.source;
        this.receivedAt = input.receivedAt ?? new Date().toISOString();
        this.headers = Object.freeze({ ...(input.headers ?? {}) });
        this.payload = Object.freeze({ ...(input.payload ?? {}) });
        this.signatureValid = input.signatureValid ?? false;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.eventId || !this.releaseId || !this.providerReference || !this.providerStatus) {
            throw new Error("ProviderStatusEvent requires non-empty identifiers and status");
        }
        Object.freeze(this);
    }
    toEvidence() {
        return new StatusEvidence({
            releaseId: this.releaseId,
            providerReference: this.providerReference,
            observedStatus: this.providerStatus,
            source: this.source,
            observedAt: this.receivedAt,
            correlationId: typeof this.payload.correlationId === "string" ? this.payload.correlationId : null,
            eventId: this.eventId,
            metadata: {
                ...this.metadata,
                signatureValid: this.signatureValid,
            },
        });
    }
}

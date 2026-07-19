import type { DistributionState } from "../../domain";
import { StatusEvidence, StatusEventCategory, StatusSyncSource } from "../types/statusTypes";

export class ProviderStatusEvent {
  readonly eventId: string;
  readonly releaseId: string;
  readonly providerReference: string;
  readonly providerStatus: string;
  readonly source: StatusSyncSource;
  readonly receivedAt: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly signatureValid: boolean;
  readonly metadata: Readonly<Record<string, unknown>>;

  constructor(input: {
    eventId: string;
    releaseId: string;
    providerReference: string;
    providerStatus: string;
    source: StatusSyncSource;
    receivedAt?: string;
    headers?: Readonly<Record<string, string>>;
    payload?: Readonly<Record<string, unknown>>;
    signatureValid?: boolean;
    metadata?: Readonly<Record<string, unknown>>;
  }) {
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

  toEvidence(): StatusEvidence {
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

export interface StatusSyncEventPublisher {
  publish(
    event:
      | { type: "WebhookReceived"; payload: Readonly<{ event: ProviderStatusEvent }> }
      | { type: "PollingStarted"; payload: Readonly<Record<string, unknown>> }
      | { type: "PollingCompleted"; payload: Readonly<Record<string, unknown>> }
      | { type: "StatusNormalized"; payload: Readonly<Record<string, unknown>> }
      | { type: "TransitionValidated"; payload: Readonly<Record<string, unknown>> }
      | { type: "TransitionRejected"; payload: Readonly<Record<string, unknown>> }
      | { type: "StateTransitionRequested"; payload: Readonly<Record<string, unknown>> }
      | { type: "ProjectionUpdated"; payload: Readonly<Record<string, unknown>> }
      | { type: "TimelineUpdated"; payload: Readonly<Record<string, unknown>> }
      | { type: "ConflictDetected"; payload: Readonly<Record<string, unknown>> }
      | { type: "ConflictResolved"; payload: Readonly<Record<string, unknown>> },
  ): Promise<void> | void;
}


import type { DistributionState } from "../../domain";

export type StatusSyncSource = "WEBHOOK" | "POLLING" | "REPLAY" | "MANUAL";

export type StatusConflictType =
  | "WebhookVsPolling"
  | "DuplicateEvent"
  | "OutOfOrderEvent"
  | "MissingEvent"
  | "LateEvent"
  | "ReplayEvent";

export type StatusResolutionStrategy =
  | "PreferWebhook"
  | "PreferPolling"
  | "PreferLatest"
  | "PreferFirst"
  | "RequireManualReview";

export type StatusEventCategory =
  | "WebhookReceived"
  | "PollingStarted"
  | "PollingCompleted"
  | "StatusNormalized"
  | "TransitionValidated"
  | "TransitionRejected"
  | "StateTransitionRequested"
  | "ProjectionUpdated"
  | "TimelineUpdated"
  | "ConflictDetected"
  | "ConflictResolved";

export class StatusTransition {
  readonly releaseId: string;
  readonly from: DistributionState | null;
  readonly to: DistributionState;
  readonly source: StatusSyncSource;
  readonly reason: string | null;
  readonly requestedAt: string;
  readonly appliedAt: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;

  constructor(input: {
    releaseId: string;
    from?: DistributionState | null;
    to: DistributionState;
    source: StatusSyncSource;
    reason?: string | null;
    requestedAt?: string;
    appliedAt?: string | null;
    metadata?: Readonly<Record<string, unknown>>;
  }) {
    this.releaseId = input.releaseId.trim();
    this.from = input.from ?? null;
    this.to = input.to;
    this.source = input.source;
    this.reason = input.reason ?? null;
    this.requestedAt = input.requestedAt ?? new Date().toISOString();
    this.appliedAt = input.appliedAt ?? null;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.releaseId) {
      throw new Error("StatusTransition.releaseId must not be empty");
    }
    Object.freeze(this);
  }
}

export class StatusEvidence {
  readonly releaseId: string;
  readonly providerReference: string | null;
  readonly observedStatus: string;
  readonly source: StatusSyncSource;
  readonly observedAt: string;
  readonly correlationId: string | null;
  readonly eventId: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;

  constructor(input: {
    releaseId: string;
    providerReference?: string | null;
    observedStatus: string;
    source: StatusSyncSource;
    observedAt?: string;
    correlationId?: string | null;
    eventId?: string | null;
    metadata?: Readonly<Record<string, unknown>>;
  }) {
    this.releaseId = input.releaseId.trim();
    this.providerReference = input.providerReference ?? null;
    this.observedStatus = input.observedStatus.trim();
    this.source = input.source;
    this.observedAt = input.observedAt ?? new Date().toISOString();
    this.correlationId = input.correlationId ?? null;
    this.eventId = input.eventId ?? null;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.releaseId || !this.observedStatus) {
      throw new Error("StatusEvidence requires releaseId and observedStatus");
    }
    Object.freeze(this);
  }
}


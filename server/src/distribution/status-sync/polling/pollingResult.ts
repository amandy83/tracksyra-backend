import { StatusSnapshot } from "../snapshot/statusSnapshot";
import { StatusTransition } from "../types/statusTypes";

export class PollingResult {
  readonly releaseId: string;
  readonly providerReference: string | null;
  readonly polledAt: string;
  readonly snapshot: StatusSnapshot;
  readonly changesDetected: boolean;
  readonly transitions: readonly StatusTransition[];
  readonly nextPollAt: string | null;
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;

  constructor(input: {
    releaseId: string;
    providerReference?: string | null;
    polledAt?: string;
    snapshot: StatusSnapshot;
    changesDetected: boolean;
    transitions?: readonly StatusTransition[];
    nextPollAt?: string | null;
    warnings?: readonly string[];
    errors?: readonly string[];
    metadata?: Readonly<Record<string, unknown>>;
  }) {
    this.releaseId = input.releaseId.trim();
    this.providerReference = input.providerReference ?? null;
    this.polledAt = input.polledAt ?? new Date().toISOString();
    this.snapshot = input.snapshot;
    this.changesDetected = input.changesDetected;
    this.transitions = Object.freeze([...(input.transitions ?? [])]);
    this.nextPollAt = input.nextPollAt ?? null;
    this.warnings = Object.freeze([...(input.warnings ?? [])]);
    this.errors = Object.freeze([...(input.errors ?? [])]);
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.releaseId) {
      throw new Error("PollingResult.releaseId must not be empty");
    }
    Object.freeze(this);
  }
}

export interface PollingProcessor {
  poll(input: {
    releaseId: string;
    providerReference?: string | null;
    snapshot: StatusSnapshot;
  }): Promise<PollingResult> | PollingResult;
}

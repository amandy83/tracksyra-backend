import type { ConnectorMetadataMap } from "../types/connectorTypes";

export class ConnectorSubmission {
  readonly submissionId: string;
  readonly connectorId: string;
  readonly releaseId: string;
  readonly submittedAt: string;
  readonly accepted: boolean;
  readonly metadata: ConnectorMetadataMap;

  constructor(input: {
    submissionId: string;
    connectorId: string;
    releaseId: string;
    submittedAt?: string;
    accepted?: boolean;
    metadata?: ConnectorMetadataMap;
  }) {
    this.submissionId = input.submissionId.trim();
    this.connectorId = input.connectorId.trim();
    this.releaseId = input.releaseId.trim();
    this.submittedAt = input.submittedAt ?? new Date().toISOString();
    this.accepted = input.accepted ?? false;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.submissionId || !this.connectorId || !this.releaseId) {
      throw new Error("ConnectorSubmission requires non-empty identifiers");
    }
    Object.freeze(this);
  }
}

export interface CatalogProvider {
  createRelease(submission: ConnectorSubmission): Promise<ConnectorSubmission> | ConnectorSubmission;
  updateRelease(submission: ConnectorSubmission): Promise<ConnectorSubmission> | ConnectorSubmission;
}


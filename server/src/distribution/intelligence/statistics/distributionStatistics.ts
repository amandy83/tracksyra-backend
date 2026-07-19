import type { ProjectionMetadata } from "../types/intelligenceTypes";

export class DistributionStatistics {
  readonly releaseId: string;
  readonly submissionCounts: number;
  readonly approvalRate: number;
  readonly distributionSuccessRate: number;
  readonly dspLatency: number;
  readonly uploadLatency: number;
  readonly failureRate: number;
  readonly retryRate: number;
  readonly royaltyTotals: number;
  readonly paymentTotals: number;
  readonly generatedAt: string;
  readonly metadata: ProjectionMetadata;

  constructor(input: {
    releaseId: string;
    submissionCounts: number;
    approvalRate: number;
    distributionSuccessRate: number;
    dspLatency: number;
    uploadLatency: number;
    failureRate: number;
    retryRate: number;
    royaltyTotals: number;
    paymentTotals: number;
    generatedAt?: string;
    metadata?: ProjectionMetadata;
  }) {
    this.releaseId = input.releaseId.trim();
    this.submissionCounts = input.submissionCounts;
    this.approvalRate = input.approvalRate;
    this.distributionSuccessRate = input.distributionSuccessRate;
    this.dspLatency = input.dspLatency;
    this.uploadLatency = input.uploadLatency;
    this.failureRate = input.failureRate;
    this.retryRate = input.retryRate;
    this.royaltyTotals = input.royaltyTotals;
    this.paymentTotals = input.paymentTotals;
    this.generatedAt = input.generatedAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.releaseId) {
      throw new Error("DistributionStatistics.releaseId must not be empty");
    }
    Object.freeze(this);
  }
}


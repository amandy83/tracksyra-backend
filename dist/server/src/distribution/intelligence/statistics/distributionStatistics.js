export class DistributionStatistics {
    releaseId;
    submissionCounts;
    approvalRate;
    distributionSuccessRate;
    dspLatency;
    uploadLatency;
    failureRate;
    retryRate;
    royaltyTotals;
    paymentTotals;
    generatedAt;
    metadata;
    constructor(input) {
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

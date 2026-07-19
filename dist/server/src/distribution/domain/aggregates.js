import { DomainInvariantError } from "./domainErrors.js";
import { freeze } from "./domainHelpers.js";
import { DistributionStateMachine } from "./distributionState.js";
import { Release } from "./entities.js";
import { ProviderStatus } from "./valueObjects.js";
export class ReleaseAggregate {
    release;
    stateMachine;
    packageModel;
    providerSubmission;
    royaltyBatchId;
    constructor(input) {
        this.release = input.release;
        this.packageModel = input.packageModel ?? null;
        this.providerSubmission = input.providerSubmission ?? null;
        this.royaltyBatchId = input.royaltyBatchId ?? null;
        this.stateMachine = input.stateMachine ?? new DistributionStateMachine();
        freeze(this);
    }
    static create(releaseId, title, primaryArtist, version, territories) {
        return new ReleaseAggregate({
            release: new Release({
                id: releaseId,
                title,
                primaryArtist,
                version,
                territories,
            }),
        });
    }
    lockSubmission(lock) {
        this.stateMachine.assertTransition(this.release.state, "SUBMISSION_LOCKED");
        return new ReleaseAggregate({
            release: new Release({ ...this.release, submissionLock: lock, state: "SUBMISSION_LOCKED" }),
            packageModel: this.packageModel,
            providerSubmission: this.providerSubmission,
            royaltyBatchId: this.royaltyBatchId,
            stateMachine: this.stateMachine,
        });
    }
    createSnapshot(snapshotId) {
        this.stateMachine.assertTransition(this.release.state, "SNAPSHOT_CREATED");
        return new ReleaseAggregate({
            release: new Release({ ...this.release, snapshotId, state: "SNAPSHOT_CREATED" }),
            packageModel: this.packageModel,
            providerSubmission: this.providerSubmission,
            royaltyBatchId: this.royaltyBatchId,
            stateMachine: this.stateMachine,
        });
    }
    transition(next) {
        this.stateMachine.assertTransition(this.release.state, next);
        return new ReleaseAggregate({
            release: this.release.withState(next),
            packageModel: this.packageModel,
            providerSubmission: this.providerSubmission,
            royaltyBatchId: this.royaltyBatchId,
            stateMachine: this.stateMachine,
        });
    }
    withPackage(packageModel) {
        return new ReleaseAggregate({
            release: this.release,
            packageModel,
            providerSubmission: this.providerSubmission,
            royaltyBatchId: this.royaltyBatchId,
            stateMachine: this.stateMachine,
        });
    }
    withProviderSubmission(providerSubmission) {
        return new ReleaseAggregate({
            release: this.release,
            packageModel: this.packageModel,
            providerSubmission,
            royaltyBatchId: this.royaltyBatchId,
            stateMachine: this.stateMachine,
        });
    }
    withRoyaltyBatch(royaltyBatchId) {
        return new ReleaseAggregate({
            release: this.release,
            packageModel: this.packageModel,
            providerSubmission: this.providerSubmission,
            royaltyBatchId,
            stateMachine: this.stateMachine,
        });
    }
}
export class DistributionJobAggregate {
    id;
    releaseId;
    state;
    providerReference;
    attempts;
    lastError;
    constructor(input) {
        this.id = input.id;
        this.releaseId = input.releaseId;
        this.state = input.state ?? "PENDING";
        this.providerReference = input.providerReference ?? null;
        this.attempts = input.attempts ?? 0;
        this.lastError = input.lastError ?? null;
        freeze(this);
    }
    queue() {
        if (this.state !== "PENDING")
            throw new DomainInvariantError("Distribution job can only be queued from PENDING", { state: this.state });
        return new DistributionJobAggregate({ ...this, state: "QUEUED" });
    }
    start() {
        if (this.state !== "QUEUED")
            throw new DomainInvariantError("Distribution job can only start from QUEUED", { state: this.state });
        return new DistributionJobAggregate({ ...this, state: "PROCESSING", attempts: this.attempts + 1 });
    }
    complete() {
        if (this.state !== "PROCESSING")
            throw new DomainInvariantError("Distribution job can only complete from PROCESSING", { state: this.state });
        return new DistributionJobAggregate({ ...this, state: "COMPLETED" });
    }
    fail(lastError) {
        if (this.state !== "PROCESSING")
            throw new DomainInvariantError("Distribution job can only fail from PROCESSING", { state: this.state });
        return new DistributionJobAggregate({ ...this, state: "FAILED", lastError });
    }
}
export class ProviderSubmissionAggregate {
    providerReference;
    receipt;
    status;
    releaseId;
    jobId;
    constructor(input) {
        this.providerReference = input.providerReference;
        this.receipt = input.receipt ?? null;
        this.status = input.status ?? new ProviderStatus("PENDING");
        this.releaseId = input.releaseId;
        this.jobId = input.jobId ?? null;
        freeze(this);
    }
    authenticate() {
        return new ProviderSubmissionAggregate({ ...this, status: new ProviderStatus("AUTHENTICATING") });
    }
    uploadStarted() {
        return new ProviderSubmissionAggregate({ ...this, status: new ProviderStatus("UPLOADING") });
    }
    uploadCompleted(receipt) {
        return new ProviderSubmissionAggregate({ ...this, receipt, status: new ProviderStatus("PROCESSING") });
    }
    providerAccepted() {
        return new ProviderSubmissionAggregate({ ...this, status: new ProviderStatus("ACCEPTED") });
    }
    providerRejected() {
        return new ProviderSubmissionAggregate({ ...this, status: new ProviderStatus("REJECTED") });
    }
    dspAccepted() {
        return new ProviderSubmissionAggregate({ ...this, status: new ProviderStatus("LIVE") });
    }
}
export class RoyaltyBatchAggregate {
    id;
    releaseId;
    records;
    paymentRecords;
    state;
    amount;
    currency;
    auditReference;
    constructor(input) {
        this.id = input.id;
        this.releaseId = input.releaseId;
        this.records = freeze([...(input.records ?? [])]);
        this.paymentRecords = freeze([...(input.paymentRecords ?? [])]);
        this.state = input.state ?? "CREATED";
        this.amount = input.amount ?? 0;
        this.currency = input.currency ?? null;
        this.auditReference = input.auditReference ?? null;
        freeze(this);
    }
    import(records) {
        if (this.state !== "CREATED")
            throw new DomainInvariantError("Royalty batch can only import from CREATED", { state: this.state });
        return new RoyaltyBatchAggregate({ ...this, records: [...this.records, ...records], state: "IMPORTED" });
    }
    calculate(amount, currency) {
        if (this.state !== "IMPORTED")
            throw new DomainInvariantError("Royalty batch can only calculate from IMPORTED", { state: this.state });
        return new RoyaltyBatchAggregate({ ...this, amount, currency, state: "CALCULATED" });
    }
    pay(paymentRecord) {
        if (this.state !== "CALCULATED")
            throw new DomainInvariantError("Royalty batch can only pay from CALCULATED", { state: this.state });
        return new RoyaltyBatchAggregate({ ...this, paymentRecords: [...this.paymentRecords, paymentRecord], state: "PAID" });
    }
    archive() {
        if (this.state !== "PAID")
            throw new DomainInvariantError("Royalty batch can only archive from PAID", { state: this.state });
        return new RoyaltyBatchAggregate({ ...this, state: "ARCHIVED" });
    }
}

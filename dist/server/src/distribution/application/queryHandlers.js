async function resolve(value) {
    return await Promise.resolve(value);
}
export class GetDistributionStatus {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(releaseId) {
        const result = await resolve(this.deps.queries.getReleaseView(releaseId));
        if (!result)
            throw new Error(`Distribution status not found for ${releaseId.value}`);
        return result;
    }
}
export class GetTimeline {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(releaseId) {
        const events = await resolve(this.deps.queries.getTimeline(releaseId));
        return { releaseId, events };
    }
}
export class GetProviderSubmission {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(releaseId) {
        const result = await resolve(this.deps.queries.getProviderSubmission(releaseId));
        if (!result)
            throw new Error(`Provider submission not found for ${releaseId.value}`);
        return result;
    }
}
export class GetRoyaltySummary {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(releaseId) {
        const result = await resolve(this.deps.queries.getRoyaltySummary(releaseId));
        if (!result)
            throw new Error(`Royalty summary not found for ${releaseId.value}`);
        return result;
    }
}
export class GetPaymentStatus {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(releaseId) {
        const result = await resolve(this.deps.queries.getPaymentSummary(releaseId));
        if (!result)
            throw new Error(`Payment status not found for ${releaseId.value}`);
        return result;
    }
}

export class SLAReport {
    reportId;
    serviceName;
    windowStart;
    windowEnd;
    availability;
    latency;
    violations;
    generatedAt;
    metadata;
    constructor(input) {
        this.reportId = input.reportId.trim();
        this.serviceName = input.serviceName.trim();
        this.windowStart = input.windowStart.trim();
        this.windowEnd = input.windowEnd.trim();
        this.availability = input.availability;
        this.latency = input.latency;
        this.violations = Object.freeze([...(input.violations ?? [])]);
        this.generatedAt = input.generatedAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.reportId || !this.serviceName || !this.windowStart || !this.windowEnd) {
            throw new Error("SLAReport requires reportId, serviceName, and window bounds");
        }
        Object.freeze(this);
    }
}

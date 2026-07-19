function projectionKey(event) {
    const payload = event.payload;
    const releaseId = typeof payload.releaseId === "string" ? payload.releaseId : null;
    const identifier = releaseId ?? event.aggregateId;
    return identifier.replace(/[^A-Za-z0-9._-]/g, "_");
}
function asRecord(payload) {
    return { ...payload };
}
export class DistributionProjection {
    store;
    constructor(store) {
        this.store = store;
    }
    async project(event) {
        const key = `projections/distribution/${projectionKey(event)}.json`;
        const current = (await this.store.read(key)) ?? {
            aggregateId: event.aggregateId,
            aggregateType: event.aggregateType,
            lastEventType: event.type,
            lastOccurredAt: event.occurredAt,
            lastPayload: asRecord(event.payload),
            eventCount: 0,
        };
        const next = {
            aggregateId: current.aggregateId,
            aggregateType: current.aggregateType,
            lastEventType: event.type,
            lastOccurredAt: event.occurredAt,
            lastPayload: asRecord(event.payload),
            eventCount: current.eventCount + 1,
        };
        await this.store.write(key, next);
    }
}
export class TimelineProjection {
    store;
    constructor(store) {
        this.store = store;
    }
    async project(event) {
        const key = `projections/timeline/${projectionKey(event)}.json`;
        const current = (await this.store.read(key)) ?? [];
        const next = [
            ...current,
            {
                type: event.type,
                occurredAt: event.occurredAt,
                payload: asRecord(event.payload),
            },
        ];
        await this.store.write(key, next);
    }
}
export class DashboardProjection {
    store;
    constructor(store) {
        this.store = store;
    }
    async project(event) {
        const payload = event.payload;
        const releaseId = typeof payload.releaseId === "string" ? payload.releaseId : event.aggregateId;
        const key = `projections/dashboard/${projectionKey(event)}.json`;
        const current = (await this.store.read(key)) ?? {
            releaseId,
            status: event.aggregateType,
            updatedAt: event.occurredAt,
            lastEventType: event.type,
            summary: {},
        };
        const next = {
            releaseId: current.releaseId,
            status: current.status,
            updatedAt: event.occurredAt,
            lastEventType: event.type,
            summary: {
                ...current.summary,
                [event.type]: asRecord(event.payload),
            },
        };
        await this.store.write(key, next);
    }
}
export class ProjectionUpdater {
    projections;
    constructor(projections = []) {
        this.projections = [...projections];
    }
    register(projection) {
        this.projections.push(projection);
    }
    async update(event) {
        for (const projection of this.projections) {
            await projection.project(event);
        }
    }
}

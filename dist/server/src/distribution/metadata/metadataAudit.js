export class MetadataAudit {
    comparator;
    records;
    constructor(comparator, records = []) {
        this.comparator = comparator;
        this.records = records;
    }
    get history() {
        return this.records;
    }
    latest() {
        return this.records[this.records.length - 1] ?? null;
    }
    record(snapshot, diff = null) {
        return new MetadataAudit(this.comparator, [
            ...this.records,
            Object.freeze({
                id: `audit_${snapshot.id}`,
                releaseId: snapshot.releaseId,
                snapshotId: snapshot.id,
                fingerprint: snapshot.fingerprint,
                createdAt: new Date(),
                diff,
                metadata: Object.freeze({ version: snapshot.version, trackCount: snapshot.trackCount }),
            }),
        ]);
    }
    compareSnapshots(before, after) {
        return this.comparator.compare(before.metadata, after.metadata);
    }
    append(before, after) {
        const diff = before ? this.compareSnapshots(before, after) : null;
        return this.record(after, diff);
    }
}

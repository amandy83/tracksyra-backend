export class InMemoryProviderMetrics {
    points = [];
    increment(name, value = 1, tags = {}) {
        this.record({ name, value, unit: "count", tags, recordedAt: new Date() });
    }
    gauge(name, value, tags = {}) {
        this.record({ name, value, unit: "count", tags, recordedAt: new Date() });
    }
    timing(name, valueMs, tags = {}) {
        this.record({ name, value: valueMs, unit: "ms", tags, recordedAt: new Date() });
    }
    record(point) {
        this.points.push(point);
    }
    snapshot() {
        return [...this.points];
    }
}

export class InMemoryMetricsCollector {
    counters = new Map();
    observations = new Map();
    increment(metric, value = 1) {
        this.counters.set(metric, (this.counters.get(metric) ?? 0) + value);
    }
    observe(metric, value) {
        const current = this.observations.get(metric) ?? [];
        current.push(value);
        this.observations.set(metric, current);
    }
}
export class HealthReporter {
    metrics;
    constructor(metrics) {
        this.metrics = metrics;
    }
    report(component, healthy, details = {}) {
        this.metrics.increment("health_reports", 1, { component, healthy });
        void details;
    }
}
export class PerformanceRecorder {
    metrics;
    constructor(metrics) {
        this.metrics = metrics;
    }
    record(metric, durationMs) {
        this.metrics.observe(metric, durationMs);
    }
}

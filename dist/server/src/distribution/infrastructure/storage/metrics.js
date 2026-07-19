export class DefaultStorageMetrics {
    metrics;
    constructor(metrics = null) {
        this.metrics = metrics;
    }
    increment(metric, value = 1, tags = {}) {
        this.metrics?.increment(metric, value, tags);
    }
    observe(metric, value, tags = {}) {
        this.metrics?.observe(metric, value, tags);
    }
}

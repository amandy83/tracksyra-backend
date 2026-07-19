const durations = new Map();
const latencies = new Map();
const retryCounts = new Map();
const health = new Map();
const counters = new Map();
const gauges = new Map();
export function recordProcessingDuration(queueName, durationMs) {
    const values = durations.get(queueName) || [];
    values.push(durationMs);
    if (values.length > 100)
        values.shift();
    durations.set(queueName, values);
}
export function recordJobLatency(queueName, latencyMs) {
    const values = latencies.get(queueName) || [];
    values.push(latencyMs);
    if (values.length > 100)
        values.shift();
    latencies.set(queueName, values);
}
export function incrementMetric(name, labels = {}, amount = 1) {
    const key = metricKey(name, labels);
    counters.set(key, (counters.get(key) || 0) + amount);
}
export function setMetric(name, labels = {}, value) {
    const key = metricKey(name, labels);
    gauges.set(key, value);
}
export function recordRetry(queueName) {
    retryCounts.set(queueName, (retryCounts.get(queueName) || 0) + 1);
}
export function setWorkerHealth(queueName, state) {
    health.set(queueName, state);
}
export async function collectQueueMetrics(queueName, queue) {
    const counts = queue
        ? await queue.getJobCounts("waiting", "delayed", "active", "failed", "completed")
        : { waiting: 0, delayed: 0, active: 0, failed: 0, completed: 0 };
    const values = durations.get(queueName) || [];
    const latencyValues = latencies.get(queueName) || [];
    const avg = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    const avgLatency = latencyValues.length ? latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length : 0;
    return {
        queueName,
        queued: (counts.waiting || 0) + (counts.delayed || 0),
        processing: counts.active || 0,
        failed: counts.failed || 0,
        completed: counts.completed || 0,
        retries: retryCounts.get(queueName) || 0,
        workerHealth: health.get(queueName) || "disabled",
        avgProcessingDurationMs: Math.round(avg),
        avgJobLatencyMs: Math.round(avgLatency),
    };
}
export function toPrometheusMetrics(snapshots) {
    const usage = getProcessUsage();
    const lines = [
        "# HELP tracksyra_queue_jobs Queue job counts by state",
        "# TYPE tracksyra_queue_jobs gauge",
        "# HELP tracksyra_queue_retries_total Queue retry count",
        "# TYPE tracksyra_queue_retries_total counter",
        "# HELP tracksyra_queue_processing_duration_ms Average processing duration",
        "# TYPE tracksyra_queue_processing_duration_ms gauge",
        "# HELP tracksyra_worker_health Worker health state where healthy=1 degraded=0 disabled=-1",
        "# TYPE tracksyra_worker_health gauge",
        "# HELP tracksyra_queue_job_latency_ms Average queue wait latency",
        "# TYPE tracksyra_queue_job_latency_ms gauge",
        "# HELP tracksyra_process_memory_bytes Worker process memory usage",
        "# TYPE tracksyra_process_memory_bytes gauge",
        "# HELP tracksyra_process_cpu_seconds_total Worker process CPU usage",
        "# TYPE tracksyra_process_cpu_seconds_total counter",
    ];
    for (const snapshot of snapshots) {
        lines.push(`tracksyra_queue_jobs{queue="${snapshot.queueName}",state="queued"} ${snapshot.queued}`);
        lines.push(`tracksyra_queue_jobs{queue="${snapshot.queueName}",state="processing"} ${snapshot.processing}`);
        lines.push(`tracksyra_queue_jobs{queue="${snapshot.queueName}",state="failed"} ${snapshot.failed}`);
        lines.push(`tracksyra_queue_jobs{queue="${snapshot.queueName}",state="completed"} ${snapshot.completed}`);
        lines.push(`tracksyra_queue_retries_total{queue="${snapshot.queueName}"} ${snapshot.retries}`);
        lines.push(`tracksyra_queue_processing_duration_ms{queue="${snapshot.queueName}"} ${snapshot.avgProcessingDurationMs}`);
        lines.push(`tracksyra_queue_job_latency_ms{queue="${snapshot.queueName}"} ${snapshot.avgJobLatencyMs}`);
        lines.push(`tracksyra_worker_health{queue="${snapshot.queueName}"} ${healthValue(snapshot.workerHealth)}`);
    }
    lines.push(`tracksyra_process_memory_bytes{type="rss"} ${usage.memoryRss}`);
    lines.push(`tracksyra_process_memory_bytes{type="heap_used"} ${usage.heapUsed}`);
    lines.push(`tracksyra_process_cpu_seconds_total{type="user"} ${usage.cpuUserSeconds}`);
    lines.push(`tracksyra_process_cpu_seconds_total{type="system"} ${usage.cpuSystemSeconds}`);
    for (const [key, value] of counters.entries()) {
        lines.push(`${key} ${value}`);
    }
    for (const [key, value] of gauges.entries()) {
        lines.push(`${key} ${value}`);
    }
    return `${lines.join("\n")}\n`;
}
function metricKey(name, labels) {
    const labelText = Object.entries(labels)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}="${String(value).replace(/"/g, '\\"')}"`)
        .join(",");
    return labelText ? `${name}{${labelText}}` : name;
}
function getProcessUsage() {
    const processRef = process;
    const memory = processRef?.memoryUsage?.() || { rss: 0, heapUsed: 0 };
    const cpu = processRef?.cpuUsage?.() || { user: 0, system: 0 };
    return {
        memoryRss: memory.rss || 0,
        heapUsed: memory.heapUsed || 0,
        cpuUserSeconds: (cpu.user || 0) / 1_000_000,
        cpuSystemSeconds: (cpu.system || 0) / 1_000_000,
    };
}
function healthValue(value) {
    if (value === "healthy")
        return 1;
    if (value === "degraded")
        return 0;
    return -1;
}

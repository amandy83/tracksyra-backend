import * as os from "node:os";
import { Alert } from "../alerts/alert.js";
import { DiagnosticReport } from "../diagnostics/diagnosticReport.js";
import { HealthStatus } from "../health/healthStatus.js";
import { Incident } from "../incidents/incident.js";
import { LogEntry } from "../logging/logEntry.js";
import { Metric } from "../metrics/metric.js";
import { PerformanceSnapshot } from "../monitoring/performanceSnapshot.js";
import { Trace } from "../tracing/trace.js";
function nowIso() {
    return new Date().toISOString();
}
function freezeRecord(value) {
    return Object.freeze({ ...value });
}
function ensure(value, field) {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error(`${field} must not be empty`);
    }
    return trimmed;
}
function categoryFromSource(source) {
    const normalized = source.trim().toLowerCase();
    if (normalized.includes("queue"))
        return "Queue";
    if (normalized.includes("worker"))
        return "Workers";
    if (normalized.includes("provider"))
        return "Providers";
    if (normalized.includes("royalty"))
        return "Royalty";
    if (normalized.includes("status"))
        return "Network";
    return "Application";
}
function metricCategoryFromName(name) {
    const normalized = name.toLowerCase();
    if (normalized.includes("latency"))
        return "Latency";
    if (normalized.includes("throughput"))
        return "Throughput";
    if (normalized.includes("retry"))
        return "Retries";
    if (normalized.includes("queue"))
        return "Queue Depth";
    if (normalized.includes("worker"))
        return "Worker Utilization";
    if (normalized.includes("royalty"))
        return "Royalty Import";
    if (normalized.includes("payment"))
        return "Payments";
    if (normalized.includes("notification"))
        return "Notifications";
    if (normalized.includes("dsp"))
        return "DSP Processing Time";
    return "Failures";
}
function traceCategoryFromName(name) {
    const normalized = name.toLowerCase();
    if (normalized.includes("submit"))
        return "Submission";
    if (normalized.includes("valid"))
        return "Validation";
    if (normalized.includes("package"))
        return "Packaging";
    if (normalized.includes("upload"))
        return "Upload";
    if (normalized.includes("provider"))
        return "Provider Processing";
    if (normalized.includes("webhook"))
        return "Webhook";
    if (normalized.includes("status"))
        return "Status Sync";
    if (normalized.includes("royalty"))
        return "Royalty";
    if (normalized.includes("payment"))
        return "Payment";
    return "Archive";
}
function alertLevelFromSeverity(severity) {
    switch (severity) {
        case "critical":
            return "Critical";
        case "error":
            return "Error";
        case "warning":
            return "Warning";
        default:
            return "Info";
    }
}
function incidentLevelFromSeverity(severity) {
    switch (severity) {
        case "critical":
            return "Critical";
        case "error":
            return "Major";
        default:
            return "Minor";
    }
}
export class RequestIdGenerator {
    generate(prefix = "req") {
        return `${ensure(prefix, "prefix")}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
    }
}
export class CorrelationIdManager {
    create(seed) {
        const prefix = seed ? seed.trim() : "corr";
        return `${ensure(prefix, "seed")}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
    }
}
export class LogContextManager {
    contexts = new Map();
    set(correlationId, context) {
        this.contexts.set(ensure(correlationId, "correlationId"), freezeRecord(context));
    }
    get(correlationId) {
        return this.contexts.get(ensure(correlationId, "correlationId")) ?? null;
    }
}
export class RuntimeLogSink {
    entries = [];
    write(entry) {
        this.entries.push(entry);
    }
    list() {
        return Object.freeze([...this.entries]);
    }
}
export class StructuredLogger {
    sink;
    requestIds;
    correlations;
    contexts;
    constructor(sink, requestIds, correlations, contexts) {
        this.sink = sink;
        this.requestIds = requestIds;
        this.correlations = correlations;
        this.contexts = contexts;
    }
    log(entry) {
        this.sink.write(entry);
        if (entry.traceId) {
            this.contexts.set(entry.traceId, { source: entry.source, level: entry.level, message: entry.message });
        }
    }
    create(level, message, source, metadata = {}, traceId, spanId) {
        const id = this.requestIds.generate("log");
        const correlationId = traceId ?? this.correlations.create(source);
        return new LogEntry({
            logId: id,
            level,
            message,
            source,
            occurredAt: nowIso(),
            traceId: correlationId,
            spanId: spanId ?? null,
            metadata: freezeRecord({ ...metadata, correlationId }),
        });
    }
}
export class LogRouter {
    logger;
    sink;
    constructor(logger, sink) {
        this.logger = logger;
        this.sink = sink;
    }
    route(entry) {
        this.logger.log(entry);
        this.sink.write(entry);
    }
}
export class LogAggregator {
    aggregated = new Map();
    add(entry) {
        const key = entry.source;
        const current = this.aggregated.get(key) ?? [];
        this.aggregated.set(key, [...current, entry]);
    }
    list(source) {
        if (!source) {
            return Object.freeze([...this.aggregated.values()].flat());
        }
        return Object.freeze([...(this.aggregated.get(source) ?? [])]);
    }
}
export class AuditLogManager {
    audits = [];
    record(event) {
        this.audits.push(event);
    }
    list() {
        return Object.freeze([...this.audits]);
    }
}
export class SecurityLogManager {
    entries = [];
    record(message, source, metadata = {}) {
        const entry = new LogEntry({
            logId: `sec:${Date.now().toString(36)}`,
            level: "warn",
            message,
            source,
            occurredAt: nowIso(),
            metadata: freezeRecord({ ...metadata, security: true }),
        });
        this.entries.push(entry);
        return entry;
    }
    list() {
        return Object.freeze([...this.entries]);
    }
}
export class ErrorLogManager {
    entries = [];
    record(error, source, metadata = {}) {
        const entry = new LogEntry({
            logId: `err:${Date.now().toString(36)}`,
            level: "error",
            message: error.message,
            source,
            occurredAt: nowIso(),
            metadata: freezeRecord({ ...metadata, stack: error.stack ?? null }),
        });
        this.entries.push(entry);
        return entry;
    }
    list() {
        return Object.freeze([...this.entries]);
    }
}
export class RuntimeCounters {
    values = new Map();
    increment(name, value = 1) {
        const key = ensure(name, "name");
        this.values.set(key, (this.values.get(key) ?? 0) + value);
    }
    snapshot() {
        return Object.freeze(Object.fromEntries(this.values.entries()));
    }
}
export class Gauges {
    values = new Map();
    set(name, value) {
        this.values.set(ensure(name, "name"), value);
    }
    snapshot() {
        return Object.freeze(Object.fromEntries(this.values.entries()));
    }
}
export class Histograms {
    values = new Map();
    observe(name, value) {
        const key = ensure(name, "name");
        this.values.set(key, [...(this.values.get(key) ?? []), value]);
    }
    snapshot() {
        return Object.freeze(Object.fromEntries([...this.values.entries()].map(([key, values]) => [key, Object.freeze([...values])])));
    }
}
export class Timers {
    durations = new Map();
    record(name, startedAt, endedAt = nowIso()) {
        const duration = new Date(endedAt).getTime() - new Date(startedAt).getTime();
        this.durations.set(ensure(name, "name"), duration);
        return duration;
    }
    snapshot() {
        return Object.freeze(Object.fromEntries(this.durations.entries()));
    }
}
export class MetricsRegistry {
    counters;
    gauges;
    histograms;
    timers;
    constructor(counters, gauges, histograms, timers) {
        this.counters = counters;
        this.gauges = gauges;
        this.histograms = histograms;
        this.timers = timers;
    }
    record(metric) {
        const category = metric.category;
        this.counters.increment(metric.name, metric.value);
        if (category === "Latency") {
            this.histograms.observe(metric.name, metric.value);
        }
        else if (category === "Throughput" || category === "Queue Depth" || category === "Worker Utilization") {
            this.gauges.set(metric.name, metric.value);
        }
    }
}
export class MetricsRuntime {
    metrics = [];
    registry;
    constructor(registry) {
        this.registry = registry;
    }
    record(metric) {
        this.metrics.push(metric);
        this.registry.record(metric);
    }
    create(name, value, metadata = {}, tags = {}) {
        return new Metric({
            metricId: `metric:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
            name,
            category: metricCategoryFromName(name),
            value,
            recordedAt: nowIso(),
            tags,
            metadata: freezeRecord(metadata),
        });
    }
    list() {
        return Object.freeze([...this.metrics]);
    }
}
export class QueueMetrics {
    snapshot(runtime) {
        return freezeRecord({ counters: runtime.registry.counters.snapshot(), gauges: runtime.registry.gauges.snapshot() });
    }
}
export class WorkerMetrics {
    snapshot(runtime) {
        return freezeRecord({ counters: runtime.registry.counters.snapshot(), gauges: runtime.registry.gauges.snapshot() });
    }
}
export class DSPRuntimeMetrics {
    snapshot(runtime) {
        return freezeRecord({ counters: runtime.registry.counters.snapshot() });
    }
}
export class RoyaltyMetrics {
    snapshot(runtime) {
        return freezeRecord({ counters: runtime.registry.counters.snapshot() });
    }
}
export class StateSyncMetrics {
    snapshot(runtime) {
        return freezeRecord({ counters: runtime.registry.counters.snapshot() });
    }
}
export class WorkflowMetrics {
    snapshot(runtime) {
        return freezeRecord({ counters: runtime.registry.counters.snapshot() });
    }
}
export class TraceContext {
    traceId;
    spanId;
    parentSpanId;
    category;
    metadata;
    constructor(traceId, spanId, parentSpanId, category, metadata = {}) {
        this.traceId = traceId;
        this.spanId = spanId;
        this.parentSpanId = parentSpanId;
        this.category = category;
        this.metadata = metadata;
        this.traceId = ensure(traceId, "traceId");
        this.spanId = spanId?.trim() ?? null;
        this.parentSpanId = parentSpanId?.trim() ?? null;
        this.category = category;
        Object.freeze(this);
    }
}
export class ParentChildSpanResolver {
    resolve(spans) {
        return Object.freeze([...spans].sort((a, b) => a.startedAt.localeCompare(b.startedAt)));
    }
}
export class SpanManager {
    spans = new Map();
    add(span) {
        const current = this.spans.get(span.traceId) ?? [];
        this.spans.set(span.traceId, [...current, span]);
    }
    list(traceId) {
        return Object.freeze([...(this.spans.get(ensure(traceId, "traceId")) ?? [])]);
    }
}
export class PipelineTraceBuilder {
    build(name, source, subject, metadata = {}) {
        return new Trace({
            traceId: `trace:${Date.now().toString(36)}`,
            category: traceCategoryFromName(name),
            name,
            rootSpanId: null,
            startedAt: nowIso(),
            spans: [],
            metadata: freezeRecord({ ...metadata, source, subject }),
        });
    }
}
export class RuntimeTracePublisher {
    traces = [];
    publish(trace) {
        this.traces.push(trace);
    }
    list() {
        return Object.freeze([...this.traces]);
    }
}
export class DistributedTraceRuntime {
    traceContext = new Map();
    spanManager;
    parentChildSpanResolver;
    pipelineTraceBuilder;
    runtimeTracePublisher;
    constructor(spanManager, parentChildSpanResolver, pipelineTraceBuilder, runtimeTracePublisher) {
        this.spanManager = spanManager;
        this.parentChildSpanResolver = parentChildSpanResolver;
        this.pipelineTraceBuilder = pipelineTraceBuilder;
        this.runtimeTracePublisher = runtimeTracePublisher;
    }
    create(name, source, subject, metadata = {}) {
        const trace = this.pipelineTraceBuilder.build(name, source, subject, metadata);
        this.runtimeTracePublisher.publish(trace);
        return trace;
    }
    addSpan(span) {
        this.spanManager.add(span);
    }
}
export class ComponentHealthRegistry {
    entries = new Map();
    register(componentId, status) {
        this.entries.set(ensure(componentId, "componentId"), status);
    }
    resolve(componentId) {
        return this.entries.get(ensure(componentId, "componentId")) ?? null;
    }
    list() {
        return Object.freeze([...this.entries.values()]);
    }
}
export class ReadinessEngine {
    evaluate(registry) {
        return registry.list().every((status) => status.healthy);
    }
}
export class LivenessEngine {
    evaluate(registry) {
        return registry.list().length > 0;
    }
}
export class StartupValidator {
    validate(registry) {
        return this.evaluate(registry);
    }
    evaluate(registry) {
        return registry.list().every((status) => status.severity !== "unhealthy");
    }
}
export class ShutdownValidator {
    validate(registry) {
        return registry.list().every((status) => status.severity !== "unhealthy");
    }
}
export class DependencyHealthAnalyzer {
    analyze(registry) {
        const entries = registry.list();
        return freezeRecord({
            total: entries.length,
            healthy: entries.filter((entry) => entry.healthy).length,
            unhealthy: entries.filter((entry) => !entry.healthy).length,
        });
    }
}
export class HealthRuntime {
    registry;
    readiness;
    liveness;
    startupValidator;
    shutdownValidator;
    dependencyAnalyzer;
    constructor(registry, readiness, liveness, startupValidator, shutdownValidator, dependencyAnalyzer) {
        this.registry = registry;
        this.readiness = readiness;
        this.liveness = liveness;
        this.startupValidator = startupValidator;
        this.shutdownValidator = shutdownValidator;
        this.dependencyAnalyzer = dependencyAnalyzer;
    }
    check(componentId, category, healthy, message) {
        const status = new HealthStatus({ componentId, category, healthy, message: message ?? null, observedAt: nowIso() });
        this.registry.register(componentId, status);
        return status;
    }
}
export class AlertRules {
    evaluate(metric) {
        if (metric instanceof HealthStatus) {
            return metric.healthy ? "Info" : metric.severity === "unhealthy" ? "Critical" : "Warning";
        }
        return metric.value > 0 ? "Info" : "Warning";
    }
}
export class IncidentTimeline {
    incidents = [];
    record(incident) {
        this.incidents.push(incident);
    }
    list() {
        return Object.freeze([...this.incidents]);
    }
}
export class EscalationPolicies {
    resolve(level) {
        switch (level) {
            case "Critical":
                return "Disaster";
            case "Error":
                return "Critical";
            case "Warning":
                return "Major";
            default:
                return "Minor";
        }
    }
}
export class RuntimeIncidentManager {
    timeline = new IncidentTimeline();
    open(incident) {
        this.timeline.record(incident);
    }
    resolve(incident) {
        this.timeline.record(new Incident({
            incidentId: incident.incidentId,
            level: incident.level,
            title: incident.title,
            description: incident.description,
            openedAt: incident.openedAt,
            resolvedAt: nowIso(),
            status: "resolved",
            metadata: freezeRecord({ ...incident.metadata, resolved: true }),
        }));
    }
}
export class AlertDispatcher {
    incidents;
    policies;
    constructor(incidents, policies) {
        this.incidents = incidents;
        this.policies = policies;
    }
    dispatch(alert) {
        this.incidents.open(new Incident({
            incidentId: `incident:${alert.alertId}`,
            level: this.policies.resolve(alert.level),
            title: alert.title,
            description: alert.message,
            openedAt: alert.raisedAt,
            status: "open",
            metadata: freezeRecord({ alertId: alert.alertId, componentId: alert.componentId }),
        }));
    }
}
export class AlertEngine {
    dispatcher;
    rules;
    alerts = [];
    constructor(dispatcher, rules) {
        this.dispatcher = dispatcher;
        this.rules = rules;
    }
    raise(alert) {
        this.alerts.push(alert);
        this.dispatcher.dispatch(alert);
    }
    evaluate(metric, componentId) {
        const level = alertLevelFromSeverity(metric instanceof HealthStatus ? metric.severity : this.rules.evaluate(metric));
        const alert = new Alert({
            alertId: `alert:${Date.now().toString(36)}`,
            level,
            title: metric instanceof HealthStatus ? metric.componentId : metric.name,
            message: metric instanceof HealthStatus ? metric.message ?? "Health degraded" : `${metric.name} recorded`,
            componentId: componentId ?? (metric instanceof HealthStatus ? metric.componentId : null),
            metadata: freezeRecord({ metric: metric instanceof Metric ? metric.name : metric.componentId }),
        });
        this.raise(alert);
        return alert;
    }
}
export class RuntimeProfiler {
    profiles = [];
    snapshot(scope) {
        const snapshot = new PerformanceSnapshot({
            snapshotId: `perf:${Date.now().toString(36)}`,
            measuredAt: nowIso(),
            releaseId: null,
            latencies: {
                scope: 1,
            },
            counts: {
                scope: 1,
            },
            metadata: freezeRecord({ scope: ensure(scope, "scope") }),
        });
        this.profiles.push(snapshot);
        return snapshot;
    }
    list() {
        return Object.freeze([...this.profiles]);
    }
}
export class MemoryAnalyzer {
    analyze() {
        return freezeRecord({ rss: process.memoryUsage().rss, heapUsed: process.memoryUsage().heapUsed });
    }
}
export class CPUAnalyzer {
    analyze() {
        return freezeRecord({ load: os.loadavg()[0] });
    }
}
export class ThroughputAnalyzer {
    analyze(metrics) {
        return freezeRecord({ counters: metrics.registry.counters.snapshot() });
    }
}
export class BottleneckDetector {
    detect(profiles) {
        return profiles.length > 10 ? ["High profiling volume"] : [];
    }
}
export class PipelinePerformanceAnalyzer {
    bottleneckDetector;
    constructor(bottleneckDetector) {
        this.bottleneckDetector = bottleneckDetector;
    }
    analyze(profiles) {
        return freezeRecord({ count: profiles.length, bottlenecks: this.bottleneckDetector.detect(profiles) });
    }
}
export class QueuePerformanceMonitor {
    analyze(metrics) {
        return freezeRecord({ counters: metrics.registry.counters.snapshot() });
    }
}
export class WorkerPerformanceMonitor {
    analyze(metrics) {
        return freezeRecord({ counters: metrics.registry.counters.snapshot() });
    }
}
export class FailureAnalyzer {
    analyze(logs) {
        return freezeRecord({ failures: logs.filter((entry) => entry.level === "error").length });
    }
}
export class RecoveryAnalyzer {
    analyze(incidents) {
        return freezeRecord({ recoveries: incidents.filter((incident) => incident.status === "resolved").length });
    }
}
export class DeadlockDetection {
    detect(logs) {
        return logs.some((entry) => entry.message.toLowerCase().includes("deadlock"));
    }
}
export class ConfigurationValidator {
    validate(metadata) {
        return Object.keys(metadata).length >= 0;
    }
}
export class DependencyDiagnostics {
    analyze(health) {
        return freezeRecord({ components: health.list().length, healthy: health.list().filter((entry) => entry.healthy).length });
    }
}
export class RuntimeDiagnostics {
    analyze(logs, metrics) {
        return freezeRecord({ logs: logs.length, counters: metrics.registry.counters.snapshot() });
    }
}
export class DiagnosticRuntime {
    dependencyDiagnostics;
    runtimeDiagnostics;
    failureAnalyzer;
    recoveryAnalyzer;
    deadlockDetection;
    configurationValidator;
    logger;
    metrics;
    health;
    constructor(dependencyDiagnostics, runtimeDiagnostics, failureAnalyzer, recoveryAnalyzer, deadlockDetection, configurationValidator, logger, metrics, health) {
        this.dependencyDiagnostics = dependencyDiagnostics;
        this.runtimeDiagnostics = runtimeDiagnostics;
        this.failureAnalyzer = failureAnalyzer;
        this.recoveryAnalyzer = recoveryAnalyzer;
        this.deadlockDetection = deadlockDetection;
        this.configurationValidator = configurationValidator;
        this.logger = logger;
        this.metrics = metrics;
        this.health = health;
    }
    generate(scope) {
        const report = new DiagnosticReport({
            reportId: `diag:${Date.now().toString(36)}`,
            scope,
            summary: `Diagnostics generated for ${scope}`,
            generatedAt: nowIso(),
            findings: [
                `deadlock=${this.deadlockDetection.detect(this.logger["sink"].list())}`,
                `healthy=${this.health.readiness.evaluate(this.health.registry)}`,
            ],
            metadata: freezeRecord({
                dependency: this.dependencyDiagnostics.analyze(this.health.registry),
                runtime: this.runtimeDiagnostics.analyze(this.logger["sink"].list(), this.metrics),
                configured: this.configurationValidator.validate({ scope }),
            }),
        });
        return report;
    }
}
export class RuntimeDashboard {
    widgetSet = new Map();
    publish(projection) {
        this.widgetSet.set(projection.projectionId, projection);
    }
}
export class WorkerDashboard extends RuntimeDashboard {
}
export class QueueDashboard extends RuntimeDashboard {
}
export class ProviderDashboard extends RuntimeDashboard {
}
export class DistributionDashboard extends RuntimeDashboard {
}
export class RoyaltyDashboard extends RuntimeDashboard {
}
export class StateSyncDashboard extends RuntimeDashboard {
}
export class SystemDashboard extends RuntimeDashboard {
}
export class RuntimeStatistics {
    snapshot(metrics) {
        return freezeRecord({
            runtime: metrics.registry.counters.snapshot(),
            worker: metrics.registry.counters.snapshot(),
            queue: metrics.registry.counters.snapshot(),
            dsp: metrics.registry.counters.snapshot(),
            release: metrics.registry.counters.snapshot(),
            royalty: metrics.registry.counters.snapshot(),
            failure: metrics.registry.counters.snapshot(),
            retry: metrics.registry.counters.snapshot(),
            recovery: metrics.registry.counters.snapshot(),
        });
    }
}
export class RuntimeMonitoringReporter {
    snapshots = [];
    report(snapshot) {
        this.snapshots.push(snapshot);
    }
}
export class HealthRuntimeReporter {
    snapshot(registry) {
        return {
            generatedAt: nowIso(),
            entries: Object.freeze(registry.list().map((status) => ({
                componentId: status.componentId,
                category: status.category,
                status,
                registeredAt: nowIso(),
            }))),
        };
    }
}
export class ObservabilityRuntime {
    dependencies;
    traceContext = null;
    logSink;
    correlationIdManager;
    requestIdGenerator;
    logContextManager;
    logger;
    logRouter;
    logAggregator;
    auditLogManager;
    securityLogManager;
    errorLogManager;
    metricsRuntime;
    metricsRegistry;
    queueMetrics;
    workerMetrics;
    dspRuntimeMetrics;
    royaltyMetrics;
    stateSyncMetrics;
    workflowMetrics;
    traceRuntime;
    componentHealthRegistry;
    healthRuntime;
    alertRules;
    incidentTimeline;
    escalationPolicies;
    incidentManager;
    alertDispatcher;
    alertEngine;
    runtimeProfiler;
    pipelinePerformanceAnalyzer;
    queuePerformanceMonitor;
    workerPerformanceMonitor;
    memoryAnalyzer;
    cpuAnalyzer;
    throughputAnalyzer;
    bottleneckDetector;
    dependencyDiagnostics;
    runtimeDiagnostics;
    failureAnalyzer;
    recoveryAnalyzer;
    deadlockDetection;
    configurationValidator;
    diagnosticRuntime;
    runtimeDashboard;
    workerDashboard;
    queueDashboard;
    providerDashboard;
    distributionDashboard;
    royaltyDashboard;
    stateSyncDashboard;
    systemDashboard;
    runtimeStatistics;
    runtimeMonitoringReporter;
    healthReporter;
    observabilityEventPublisher;
    runtimeCounters;
    gauges;
    histograms;
    timers;
    spanManager;
    parentChildSpanResolver;
    pipelineTraceBuilder;
    runtimeTracePublisher;
    readinessEngine;
    livenessEngine;
    startupValidator;
    shutdownValidator;
    dependencyHealthAnalyzer;
    constructor(dependencies) {
        this.dependencies = dependencies;
        this.logSink = dependencies.logSink;
        this.correlationIdManager = dependencies.correlationIdManager;
        this.requestIdGenerator = dependencies.requestIdGenerator;
        this.logContextManager = dependencies.logContextManager;
        this.logger = dependencies.logger;
        this.logRouter = dependencies.logRouter;
        this.logAggregator = dependencies.logAggregator;
        this.auditLogManager = dependencies.auditLogManager;
        this.securityLogManager = dependencies.securityLogManager;
        this.errorLogManager = dependencies.errorLogManager;
        this.metricsRuntime = dependencies.metricsRuntime;
        this.metricsRegistry = dependencies.metricsRegistry;
        this.queueMetrics = dependencies.queueMetrics;
        this.workerMetrics = dependencies.workerMetrics;
        this.dspRuntimeMetrics = dependencies.dspRuntimeMetrics;
        this.royaltyMetrics = dependencies.royaltyMetrics;
        this.stateSyncMetrics = dependencies.stateSyncMetrics;
        this.workflowMetrics = dependencies.workflowMetrics;
        this.traceRuntime = dependencies.traceRuntime;
        this.componentHealthRegistry = dependencies.componentHealthRegistry;
        this.healthRuntime = dependencies.healthRuntime;
        this.alertRules = dependencies.alertRules;
        this.incidentTimeline = dependencies.incidentTimeline;
        this.escalationPolicies = dependencies.escalationPolicies;
        this.incidentManager = dependencies.incidentManager;
        this.alertDispatcher = dependencies.alertDispatcher;
        this.alertEngine = dependencies.alertEngine;
        this.runtimeProfiler = dependencies.runtimeProfiler;
        this.pipelinePerformanceAnalyzer = dependencies.pipelinePerformanceAnalyzer;
        this.queuePerformanceMonitor = dependencies.queuePerformanceMonitor;
        this.workerPerformanceMonitor = dependencies.workerPerformanceMonitor;
        this.memoryAnalyzer = dependencies.memoryAnalyzer;
        this.cpuAnalyzer = dependencies.cpuAnalyzer;
        this.throughputAnalyzer = dependencies.throughputAnalyzer;
        this.bottleneckDetector = dependencies.bottleneckDetector;
        this.dependencyDiagnostics = dependencies.dependencyDiagnostics;
        this.runtimeDiagnostics = dependencies.runtimeDiagnostics;
        this.failureAnalyzer = dependencies.failureAnalyzer;
        this.recoveryAnalyzer = dependencies.recoveryAnalyzer;
        this.deadlockDetection = dependencies.deadlockDetection;
        this.configurationValidator = dependencies.configurationValidator;
        this.diagnosticRuntime = dependencies.diagnosticRuntime;
        this.runtimeDashboard = dependencies.runtimeDashboard;
        this.workerDashboard = dependencies.workerDashboard;
        this.queueDashboard = dependencies.queueDashboard;
        this.providerDashboard = dependencies.providerDashboard;
        this.distributionDashboard = dependencies.distributionDashboard;
        this.royaltyDashboard = dependencies.royaltyDashboard;
        this.stateSyncDashboard = dependencies.stateSyncDashboard;
        this.systemDashboard = dependencies.systemDashboard;
        this.runtimeStatistics = dependencies.runtimeStatistics;
        this.runtimeMonitoringReporter = dependencies.runtimeMonitoringReporter;
        this.healthReporter = dependencies.healthReporter;
        this.observabilityEventPublisher = dependencies.observabilityEventPublisher;
        this.runtimeCounters = this.metricsRegistry.counters;
        this.gauges = this.metricsRegistry.gauges;
        this.histograms = this.metricsRegistry.histograms;
        this.timers = this.metricsRegistry.timers;
        this.spanManager = this.traceRuntime.spanManager;
        this.parentChildSpanResolver = this.traceRuntime.parentChildSpanResolver;
        this.pipelineTraceBuilder = this.traceRuntime.pipelineTraceBuilder;
        this.runtimeTracePublisher = this.traceRuntime.runtimeTracePublisher;
        this.readinessEngine = this.healthRuntime.readiness;
        this.livenessEngine = this.healthRuntime.liveness;
        this.startupValidator = this.healthRuntime.startupValidator;
        this.shutdownValidator = this.healthRuntime.shutdownValidator;
        this.dependencyHealthAnalyzer = this.healthRuntime.dependencyAnalyzer;
    }
    log(level, message, source, metadata = {}, traceId, spanId) {
        const entry = this.logger.create(level, message, source, metadata, traceId, spanId);
        this.logRouter.route(entry);
        this.logAggregator.add(entry);
        return entry;
    }
    metric(name, value, tags = {}, metadata = {}) {
        const metric = this.metricsRuntime.create(name, value, metadata, tags);
        this.metricsRuntime.record(metric);
        return metric;
    }
    trace(name, source, subject, metadata = {}) {
        const trace = this.traceRuntime.create(name, source, subject, metadata);
        return trace;
    }
    health(componentId, category, healthy, message) {
        const status = this.healthRuntime.check(componentId, category, healthy, message);
        this.componentHealthRegistry.register(componentId, status);
        return status;
    }
}
export class ObservabilityEventPublisherFacade {
    events = [];
    publish(event) {
        this.events.push(event);
    }
    list() {
        return Object.freeze([...this.events]);
    }
}

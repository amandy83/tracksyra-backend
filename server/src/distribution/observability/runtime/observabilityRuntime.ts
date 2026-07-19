import * as os from "node:os";
import { Alert } from "../alerts/alert";
import { AuditEvent } from "../audit/auditEvent";
import { DashboardProjection } from "../dashboards/dashboardProjection";
import { DiagnosticReport } from "../diagnostics/diagnosticReport";
import { ObservabilityEvent } from "../events/observabilityEvent";
import { HealthCheck } from "../health/healthCheck";
import { HealthRegistryEntry, HealthRegistrySnapshot } from "../health/healthRegistry";
import { HealthStatus } from "../health/healthStatus";
import { Incident } from "../incidents/incident";
import { LogEntry } from "../logging/logEntry";
import { Metric } from "../metrics/metric";
import { MonitoringSnapshot } from "../monitoring/monitoringSnapshot";
import { PerformanceSnapshot } from "../monitoring/performanceSnapshot";
import { RetentionPolicy } from "../retention/retentionPolicy";
import { SLAReport } from "../sla/slaReport";
import { Span } from "../tracing/span";
import { Trace } from "../tracing/trace";
import type { ObservabilityMetadata, HealthCategory, MetricCategory, TraceCategory, AlertLevel, IncidentLevel } from "../types/observabilityTypes";
import type {
  AlertManager,
  AuditService,
  DashboardPublisher,
  DiagnosticService,
  HealthChecker,
  HealthRegistry,
  IncidentManager as IncidentManagerContract,
  Logger,
  MetricsCollector,
  MonitoringReporter,
  Profiler,
  RetentionManager,
  SLAService,
  TraceCollector,
} from "../contracts/observabilityContracts";

type RuntimeTags = Readonly<Record<string, string | number | boolean>>;

function nowIso(): string {
  return new Date().toISOString();
}

function freezeRecord<T extends Readonly<Record<string, unknown>>>(value: T): T {
  return Object.freeze({ ...value }) as T;
}

function ensure(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} must not be empty`);
  }
  return trimmed;
}

function categoryFromSource(source: string): string {
  const normalized = source.trim().toLowerCase();
  if (normalized.includes("queue")) return "Queue";
  if (normalized.includes("worker")) return "Workers";
  if (normalized.includes("provider")) return "Providers";
  if (normalized.includes("royalty")) return "Royalty";
  if (normalized.includes("status")) return "Network";
  return "Application";
}

function metricCategoryFromName(name: string): MetricCategory {
  const normalized = name.toLowerCase();
  if (normalized.includes("latency")) return "Latency";
  if (normalized.includes("throughput")) return "Throughput";
  if (normalized.includes("retry")) return "Retries";
  if (normalized.includes("queue")) return "Queue Depth";
  if (normalized.includes("worker")) return "Worker Utilization";
  if (normalized.includes("royalty")) return "Royalty Import";
  if (normalized.includes("payment")) return "Payments";
  if (normalized.includes("notification")) return "Notifications";
  if (normalized.includes("dsp")) return "DSP Processing Time";
  return "Failures";
}

function traceCategoryFromName(name: string): TraceCategory {
  const normalized = name.toLowerCase();
  if (normalized.includes("submit")) return "Submission";
  if (normalized.includes("valid")) return "Validation";
  if (normalized.includes("package")) return "Packaging";
  if (normalized.includes("upload")) return "Upload";
  if (normalized.includes("provider")) return "Provider Processing";
  if (normalized.includes("webhook")) return "Webhook";
  if (normalized.includes("status")) return "Status Sync";
  if (normalized.includes("royalty")) return "Royalty";
  if (normalized.includes("payment")) return "Payment";
  return "Archive";
}

function alertLevelFromSeverity(severity: string): AlertLevel {
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

function incidentLevelFromSeverity(severity: string): IncidentLevel {
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
  generate(prefix = "req"): string {
    return `${ensure(prefix, "prefix")}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
  }
}

export class CorrelationIdManager {
  create(seed?: string | null): string {
    const prefix = seed ? seed.trim() : "corr";
    return `${ensure(prefix, "seed")}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
  }
}

export class LogContextManager {
  private readonly contexts = new Map<string, Readonly<Record<string, unknown>>>();

  set(correlationId: string, context: Readonly<Record<string, unknown>>): void {
    this.contexts.set(ensure(correlationId, "correlationId"), freezeRecord(context));
  }

  get(correlationId: string): Readonly<Record<string, unknown>> | null {
    return this.contexts.get(ensure(correlationId, "correlationId")) ?? null;
  }
}

export class RuntimeLogSink {
  private readonly entries: LogEntry[] = [];

  write(entry: LogEntry): void {
    this.entries.push(entry);
  }

  list(): readonly LogEntry[] {
    return Object.freeze([...this.entries]);
  }
}

export class StructuredLogger implements Logger {
  constructor(
    private readonly sink: RuntimeLogSink,
    private readonly requestIds: RequestIdGenerator,
    private readonly correlations: CorrelationIdManager,
    private readonly contexts: LogContextManager,
  ) {}

  log(entry: LogEntry): void {
    this.sink.write(entry);
    if (entry.traceId) {
      this.contexts.set(entry.traceId, { source: entry.source, level: entry.level, message: entry.message });
    }
  }

  create(level: LogEntry["level"], message: string, source: string, metadata: ObservabilityMetadata = {}, traceId?: string | null, spanId?: string | null): LogEntry {
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
  constructor(private readonly logger: StructuredLogger, private readonly sink: RuntimeLogSink) {}

  route(entry: LogEntry): void {
    this.logger.log(entry);
    this.sink.write(entry);
  }
}

export class LogAggregator {
  private readonly aggregated = new Map<string, LogEntry[]>();

  add(entry: LogEntry): void {
    const key = entry.source;
    const current = this.aggregated.get(key) ?? [];
    this.aggregated.set(key, [...current, entry]);
  }

  list(source?: string): readonly LogEntry[] {
    if (!source) {
      return Object.freeze([...this.aggregated.values()].flat());
    }
    return Object.freeze([...(this.aggregated.get(source) ?? [])]);
  }
}

export class AuditLogManager {
  private readonly audits: AuditEvent[] = [];

  record(event: AuditEvent): void {
    this.audits.push(event);
  }

  list(): readonly AuditEvent[] {
    return Object.freeze([...this.audits]);
  }
}

export class SecurityLogManager {
  private readonly entries: LogEntry[] = [];

  record(message: string, source: string, metadata: ObservabilityMetadata = {}): LogEntry {
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

  list(): readonly LogEntry[] {
    return Object.freeze([...this.entries]);
  }
}

export class ErrorLogManager {
  private readonly entries: LogEntry[] = [];

  record(error: Error, source: string, metadata: ObservabilityMetadata = {}): LogEntry {
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

  list(): readonly LogEntry[] {
    return Object.freeze([...this.entries]);
  }
}

export class RuntimeCounters {
  private readonly values = new Map<string, number>();

  increment(name: string, value = 1): void {
    const key = ensure(name, "name");
    this.values.set(key, (this.values.get(key) ?? 0) + value);
  }

  snapshot(): Readonly<Record<string, number>> {
    return Object.freeze(Object.fromEntries(this.values.entries()));
  }
}

export class Gauges {
  private readonly values = new Map<string, number>();

  set(name: string, value: number): void {
    this.values.set(ensure(name, "name"), value);
  }

  snapshot(): Readonly<Record<string, number>> {
    return Object.freeze(Object.fromEntries(this.values.entries()));
  }
}

export class Histograms {
  private readonly values = new Map<string, number[]>();

  observe(name: string, value: number): void {
    const key = ensure(name, "name");
    this.values.set(key, [...(this.values.get(key) ?? []), value]);
  }

  snapshot(): Readonly<Record<string, readonly number[]>> {
    return Object.freeze(Object.fromEntries([...this.values.entries()].map(([key, values]) => [key, Object.freeze([...values])])));
  }
}

export class Timers {
  private readonly durations = new Map<string, number>();

  record(name: string, startedAt: string, endedAt: string = nowIso()): number {
    const duration = new Date(endedAt).getTime() - new Date(startedAt).getTime();
    this.durations.set(ensure(name, "name"), duration);
    return duration;
  }

  snapshot(): Readonly<Record<string, number>> {
    return Object.freeze(Object.fromEntries(this.durations.entries()));
  }
}

export class MetricsRegistry {
  readonly counters: RuntimeCounters;
  readonly gauges: Gauges;
  readonly histograms: Histograms;
  readonly timers: Timers;

  constructor(counters: RuntimeCounters, gauges: Gauges, histograms: Histograms, timers: Timers) {
    this.counters = counters;
    this.gauges = gauges;
    this.histograms = histograms;
    this.timers = timers;
  }

  record(metric: Metric): void {
    const category = metric.category;
    this.counters.increment(metric.name, metric.value);
    if (category === "Latency") {
      this.histograms.observe(metric.name, metric.value);
    } else if (category === "Throughput" || category === "Queue Depth" || category === "Worker Utilization") {
      this.gauges.set(metric.name, metric.value);
    }
  }
}

export class MetricsRuntime implements MetricsCollector {
  private readonly metrics: Metric[] = [];
  readonly registry: MetricsRegistry;

  constructor(registry: MetricsRegistry) {
    this.registry = registry;
  }

  record(metric: Metric): void {
    this.metrics.push(metric);
    this.registry.record(metric);
  }

  create(name: string, value: number, metadata: ObservabilityMetadata = {}, tags: RuntimeTags = {}): Metric {
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

  list(): readonly Metric[] {
    return Object.freeze([...this.metrics]);
  }
}

export class QueueMetrics {
  snapshot(runtime: MetricsRuntime): Readonly<Record<string, unknown>> {
    return freezeRecord({ counters: runtime.registry.counters.snapshot(), gauges: runtime.registry.gauges.snapshot() });
  }
}

export class WorkerMetrics {
  snapshot(runtime: MetricsRuntime): Readonly<Record<string, unknown>> {
    return freezeRecord({ counters: runtime.registry.counters.snapshot(), gauges: runtime.registry.gauges.snapshot() });
  }
}

export class DSPRuntimeMetrics {
  snapshot(runtime: MetricsRuntime): Readonly<Record<string, unknown>> {
    return freezeRecord({ counters: runtime.registry.counters.snapshot() });
  }
}

export class RoyaltyMetrics {
  snapshot(runtime: MetricsRuntime): Readonly<Record<string, unknown>> {
    return freezeRecord({ counters: runtime.registry.counters.snapshot() });
  }
}

export class StateSyncMetrics {
  snapshot(runtime: MetricsRuntime): Readonly<Record<string, unknown>> {
    return freezeRecord({ counters: runtime.registry.counters.snapshot() });
  }
}

export class WorkflowMetrics {
  snapshot(runtime: MetricsRuntime): Readonly<Record<string, unknown>> {
    return freezeRecord({ counters: runtime.registry.counters.snapshot() });
  }
}

export class TraceContext {
  constructor(
    readonly traceId: string,
    readonly spanId: string | null,
    readonly parentSpanId: string | null,
    readonly category: TraceCategory,
    readonly metadata: ObservabilityMetadata = {},
  ) {
    this.traceId = ensure(traceId, "traceId");
    this.spanId = spanId?.trim() ?? null;
    this.parentSpanId = parentSpanId?.trim() ?? null;
    this.category = category;
    Object.freeze(this);
  }
}

export class ParentChildSpanResolver {
  resolve(spans: readonly Span[]): readonly Span[] {
    return Object.freeze([...spans].sort((a, b) => a.startedAt.localeCompare(b.startedAt)));
  }
}

export class SpanManager {
  private readonly spans = new Map<string, Span[]>();

  add(span: Span): void {
    const current = this.spans.get(span.traceId) ?? [];
    this.spans.set(span.traceId, [...current, span]);
  }

  list(traceId: string): readonly Span[] {
    return Object.freeze([...(this.spans.get(ensure(traceId, "traceId")) ?? [])]);
  }
}

export class PipelineTraceBuilder {
  build(name: string, source: string, subject: string, metadata: ObservabilityMetadata = {}): Trace {
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
  private readonly traces: Trace[] = [];

  publish(trace: Trace): void {
    this.traces.push(trace);
  }

  list(): readonly Trace[] {
    return Object.freeze([...this.traces]);
  }
}

export class DistributedTraceRuntime {
  readonly traceContext = new Map<string, TraceContext>();
  readonly spanManager: SpanManager;
  readonly parentChildSpanResolver: ParentChildSpanResolver;
  readonly pipelineTraceBuilder: PipelineTraceBuilder;
  readonly runtimeTracePublisher: RuntimeTracePublisher;

  constructor(
    spanManager: SpanManager,
    parentChildSpanResolver: ParentChildSpanResolver,
    pipelineTraceBuilder: PipelineTraceBuilder,
    runtimeTracePublisher: RuntimeTracePublisher,
  ) {
    this.spanManager = spanManager;
    this.parentChildSpanResolver = parentChildSpanResolver;
    this.pipelineTraceBuilder = pipelineTraceBuilder;
    this.runtimeTracePublisher = runtimeTracePublisher;
  }

  create(name: string, source: string, subject: string, metadata: ObservabilityMetadata = {}): Trace {
    const trace = this.pipelineTraceBuilder.build(name, source, subject, metadata);
    this.runtimeTracePublisher.publish(trace);
    return trace;
  }

  addSpan(span: Span): void {
    this.spanManager.add(span);
  }
}

export class ComponentHealthRegistry {
  private readonly entries = new Map<string, HealthStatus>();

  register(componentId: string, status: HealthStatus): void {
    this.entries.set(ensure(componentId, "componentId"), status);
  }

  resolve(componentId: string): HealthStatus | null {
    return this.entries.get(ensure(componentId, "componentId")) ?? null;
  }

  list(): readonly HealthStatus[] {
    return Object.freeze([...this.entries.values()]);
  }
}

export class ReadinessEngine {
  evaluate(registry: ComponentHealthRegistry): boolean {
    return registry.list().every((status) => status.healthy);
  }
}

export class LivenessEngine {
  evaluate(registry: ComponentHealthRegistry): boolean {
    return registry.list().length > 0;
  }
}

export class StartupValidator {
  validate(registry: ComponentHealthRegistry): boolean {
    return this.evaluate(registry);
  }

  private evaluate(registry: ComponentHealthRegistry): boolean {
    return registry.list().every((status) => status.severity !== "unhealthy");
  }
}

export class ShutdownValidator {
  validate(registry: ComponentHealthRegistry): boolean {
    return registry.list().every((status) => status.severity !== "unhealthy");
  }
}

export class DependencyHealthAnalyzer {
  analyze(registry: ComponentHealthRegistry): Readonly<Record<string, unknown>> {
    const entries = registry.list();
    return freezeRecord({
      total: entries.length,
      healthy: entries.filter((entry) => entry.healthy).length,
      unhealthy: entries.filter((entry) => !entry.healthy).length,
    });
  }
}

export class HealthRuntime {
  readonly registry: ComponentHealthRegistry;
  readonly readiness: ReadinessEngine;
  readonly liveness: LivenessEngine;
  readonly startupValidator: StartupValidator;
  readonly shutdownValidator: ShutdownValidator;
  readonly dependencyAnalyzer: DependencyHealthAnalyzer;

  constructor(
    registry: ComponentHealthRegistry,
    readiness: ReadinessEngine,
    liveness: LivenessEngine,
    startupValidator: StartupValidator,
    shutdownValidator: ShutdownValidator,
    dependencyAnalyzer: DependencyHealthAnalyzer,
  ) {
    this.registry = registry;
    this.readiness = readiness;
    this.liveness = liveness;
    this.startupValidator = startupValidator;
    this.shutdownValidator = shutdownValidator;
    this.dependencyAnalyzer = dependencyAnalyzer;
  }

  check(componentId: string, category: HealthCategory, healthy: boolean, message?: string | null): HealthStatus {
    const status = new HealthStatus({ componentId, category, healthy, message: message ?? null, observedAt: nowIso() });
    this.registry.register(componentId, status);
    return status;
  }
}

export class AlertRules {
  evaluate(metric: Metric | HealthStatus): AlertLevel {
    if (metric instanceof HealthStatus) {
      return metric.healthy ? "Info" : metric.severity === "unhealthy" ? "Critical" : "Warning";
    }
    return metric.value > 0 ? "Info" : "Warning";
  }
}

export class IncidentTimeline {
  private readonly incidents: Incident[] = [];

  record(incident: Incident): void {
    this.incidents.push(incident);
  }

  list(): readonly Incident[] {
    return Object.freeze([...this.incidents]);
  }
}

export class EscalationPolicies {
  resolve(level: AlertLevel): IncidentLevel {
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

export class RuntimeIncidentManager implements IncidentManagerContract {
  readonly timeline = new IncidentTimeline();

  open(incident: Incident): void {
    this.timeline.record(incident);
  }

  resolve(incident: Incident): void {
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
  constructor(private readonly incidents: RuntimeIncidentManager, private readonly policies: EscalationPolicies) {}

  dispatch(alert: Alert): void {
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

export class AlertEngine implements AlertManager {
  private readonly alerts: Alert[] = [];

  constructor(private readonly dispatcher: AlertDispatcher, private readonly rules: AlertRules) {}

  raise(alert: Alert): void {
    this.alerts.push(alert);
    this.dispatcher.dispatch(alert);
  }

  evaluate(metric: Metric | HealthStatus, componentId?: string | null): Alert {
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
  private readonly profiles: PerformanceSnapshot[] = [];

  snapshot(scope: string): PerformanceSnapshot {
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

  list(): readonly PerformanceSnapshot[] {
    return Object.freeze([...this.profiles]);
  }
}

export class MemoryAnalyzer {
  analyze(): Readonly<Record<string, unknown>> {
    return freezeRecord({ rss: process.memoryUsage().rss, heapUsed: process.memoryUsage().heapUsed });
  }
}

export class CPUAnalyzer {
  analyze(): Readonly<Record<string, unknown>> {
    return freezeRecord({ load: os.loadavg()[0] });
  }
}

export class ThroughputAnalyzer {
  analyze(metrics: MetricsRuntime): Readonly<Record<string, unknown>> {
    return freezeRecord({ counters: metrics.registry.counters.snapshot() });
  }
}

export class BottleneckDetector {
  detect(profiles: readonly PerformanceSnapshot[]): readonly string[] {
    return profiles.length > 10 ? ["High profiling volume"] : [];
  }
}

export class PipelinePerformanceAnalyzer {
  constructor(private readonly bottleneckDetector: BottleneckDetector) {}

  analyze(profiles: readonly PerformanceSnapshot[]): Readonly<Record<string, unknown>> {
    return freezeRecord({ count: profiles.length, bottlenecks: this.bottleneckDetector.detect(profiles) });
  }
}

export class QueuePerformanceMonitor {
  analyze(metrics: MetricsRuntime): Readonly<Record<string, unknown>> {
    return freezeRecord({ counters: metrics.registry.counters.snapshot() });
  }
}

export class WorkerPerformanceMonitor {
  analyze(metrics: MetricsRuntime): Readonly<Record<string, unknown>> {
    return freezeRecord({ counters: metrics.registry.counters.snapshot() });
  }
}

export class FailureAnalyzer {
  analyze(logs: readonly LogEntry[]): Readonly<Record<string, unknown>> {
    return freezeRecord({ failures: logs.filter((entry) => entry.level === "error").length });
  }
}

export class RecoveryAnalyzer {
  analyze(incidents: readonly Incident[]): Readonly<Record<string, unknown>> {
    return freezeRecord({ recoveries: incidents.filter((incident) => incident.status === "resolved").length });
  }
}

export class DeadlockDetection {
  detect(logs: readonly LogEntry[]): boolean {
    return logs.some((entry) => entry.message.toLowerCase().includes("deadlock"));
  }
}

export class ConfigurationValidator {
  validate(metadata: ObservabilityMetadata): boolean {
    return Object.keys(metadata).length >= 0;
  }
}

export class DependencyDiagnostics {
  analyze(health: ComponentHealthRegistry): Readonly<Record<string, unknown>> {
    return freezeRecord({ components: health.list().length, healthy: health.list().filter((entry) => entry.healthy).length });
  }
}

export class RuntimeDiagnostics {
  analyze(logs: readonly LogEntry[], metrics: MetricsRuntime): Readonly<Record<string, unknown>> {
    return freezeRecord({ logs: logs.length, counters: metrics.registry.counters.snapshot() });
  }
}

export class DiagnosticRuntime implements DiagnosticService {
  constructor(
    private readonly dependencyDiagnostics: DependencyDiagnostics,
    private readonly runtimeDiagnostics: RuntimeDiagnostics,
    private readonly failureAnalyzer: FailureAnalyzer,
    private readonly recoveryAnalyzer: RecoveryAnalyzer,
    private readonly deadlockDetection: DeadlockDetection,
    private readonly configurationValidator: ConfigurationValidator,
    private readonly logger: StructuredLogger,
    private readonly metrics: MetricsRuntime,
    private readonly health: HealthRuntime,
  ) {}

  generate(scope: string): DiagnosticReport {
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
  readonly widgetSet = new Map<string, DashboardProjection>();

  publish(projection: DashboardProjection): void {
    this.widgetSet.set(projection.projectionId, projection);
  }
}

export class WorkerDashboard extends RuntimeDashboard {}
export class QueueDashboard extends RuntimeDashboard {}
export class ProviderDashboard extends RuntimeDashboard {}
export class DistributionDashboard extends RuntimeDashboard {}
export class RoyaltyDashboard extends RuntimeDashboard {}
export class StateSyncDashboard extends RuntimeDashboard {}
export class SystemDashboard extends RuntimeDashboard {}

export class RuntimeStatistics {
  snapshot(metrics: MetricsRuntime): Readonly<Record<string, unknown>> {
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

export class RuntimeMonitoringReporter implements MonitoringReporter {
  private readonly snapshots: (MonitoringSnapshot | PerformanceSnapshot)[] = [];

  report(snapshot: MonitoringSnapshot | PerformanceSnapshot): void {
    this.snapshots.push(snapshot);
  }
}

export class HealthRuntimeReporter {
  snapshot(registry: ComponentHealthRegistry): HealthRegistrySnapshot {
    return {
      generatedAt: nowIso(),
      entries: Object.freeze(
        registry.list().map((status) => ({
          componentId: status.componentId,
          category: status.category,
          status,
          registeredAt: nowIso(),
        }) as HealthRegistryEntry),
      ),
    };
  }
}

export type ObservabilityRuntimeDependencies = Readonly<{
  logSink: RuntimeLogSink;
  correlationIdManager: CorrelationIdManager;
  requestIdGenerator: RequestIdGenerator;
  logContextManager: LogContextManager;
  logger: StructuredLogger;
  logRouter: LogRouter;
  logAggregator: LogAggregator;
  auditLogManager: AuditLogManager;
  securityLogManager: SecurityLogManager;
  errorLogManager: ErrorLogManager;
  metricsRuntime: MetricsRuntime;
  metricsRegistry: MetricsRegistry;
  queueMetrics: QueueMetrics;
  workerMetrics: WorkerMetrics;
  dspRuntimeMetrics: DSPRuntimeMetrics;
  royaltyMetrics: RoyaltyMetrics;
  stateSyncMetrics: StateSyncMetrics;
  workflowMetrics: WorkflowMetrics;
  traceRuntime: DistributedTraceRuntime;
  componentHealthRegistry: ComponentHealthRegistry;
  healthRuntime: HealthRuntime;
  alertRules: AlertRules;
  incidentTimeline: IncidentTimeline;
  escalationPolicies: EscalationPolicies;
  incidentManager: RuntimeIncidentManager;
  alertDispatcher: AlertDispatcher;
  alertEngine: AlertEngine;
  runtimeProfiler: RuntimeProfiler;
  pipelinePerformanceAnalyzer: PipelinePerformanceAnalyzer;
  queuePerformanceMonitor: QueuePerformanceMonitor;
  workerPerformanceMonitor: WorkerPerformanceMonitor;
  memoryAnalyzer: MemoryAnalyzer;
  cpuAnalyzer: CPUAnalyzer;
  throughputAnalyzer: ThroughputAnalyzer;
  bottleneckDetector: BottleneckDetector;
  dependencyDiagnostics: DependencyDiagnostics;
  runtimeDiagnostics: RuntimeDiagnostics;
  failureAnalyzer: FailureAnalyzer;
  recoveryAnalyzer: RecoveryAnalyzer;
  deadlockDetection: DeadlockDetection;
  configurationValidator: ConfigurationValidator;
  diagnosticRuntime: DiagnosticRuntime;
  runtimeDashboard: RuntimeDashboard;
  workerDashboard: WorkerDashboard;
  queueDashboard: QueueDashboard;
  providerDashboard: ProviderDashboard;
  distributionDashboard: DistributionDashboard;
  royaltyDashboard: RoyaltyDashboard;
  stateSyncDashboard: StateSyncDashboard;
  systemDashboard: SystemDashboard;
  runtimeStatistics: RuntimeStatistics;
  runtimeMonitoringReporter: RuntimeMonitoringReporter;
  healthReporter: HealthRuntimeReporter;
  observabilityEventPublisher: ObservabilityEventPublisherFacade;
}>;

export class ObservabilityRuntime {
  readonly traceContext: TraceContext | null = null;
  readonly logSink: RuntimeLogSink;
  readonly correlationIdManager: CorrelationIdManager;
  readonly requestIdGenerator: RequestIdGenerator;
  readonly logContextManager: LogContextManager;
  readonly logger: StructuredLogger;
  readonly logRouter: LogRouter;
  readonly logAggregator: LogAggregator;
  readonly auditLogManager: AuditLogManager;
  readonly securityLogManager: SecurityLogManager;
  readonly errorLogManager: ErrorLogManager;
  readonly metricsRuntime: MetricsRuntime;
  readonly metricsRegistry: MetricsRegistry;
  readonly queueMetrics: QueueMetrics;
  readonly workerMetrics: WorkerMetrics;
  readonly dspRuntimeMetrics: DSPRuntimeMetrics;
  readonly royaltyMetrics: RoyaltyMetrics;
  readonly stateSyncMetrics: StateSyncMetrics;
  readonly workflowMetrics: WorkflowMetrics;
  readonly traceRuntime: DistributedTraceRuntime;
  readonly componentHealthRegistry: ComponentHealthRegistry;
  readonly healthRuntime: HealthRuntime;
  readonly alertRules: AlertRules;
  readonly incidentTimeline: IncidentTimeline;
  readonly escalationPolicies: EscalationPolicies;
  readonly incidentManager: RuntimeIncidentManager;
  readonly alertDispatcher: AlertDispatcher;
  readonly alertEngine: AlertEngine;
  readonly runtimeProfiler: RuntimeProfiler;
  readonly pipelinePerformanceAnalyzer: PipelinePerformanceAnalyzer;
  readonly queuePerformanceMonitor: QueuePerformanceMonitor;
  readonly workerPerformanceMonitor: WorkerPerformanceMonitor;
  readonly memoryAnalyzer: MemoryAnalyzer;
  readonly cpuAnalyzer: CPUAnalyzer;
  readonly throughputAnalyzer: ThroughputAnalyzer;
  readonly bottleneckDetector: BottleneckDetector;
  readonly dependencyDiagnostics: DependencyDiagnostics;
  readonly runtimeDiagnostics: RuntimeDiagnostics;
  readonly failureAnalyzer: FailureAnalyzer;
  readonly recoveryAnalyzer: RecoveryAnalyzer;
  readonly deadlockDetection: DeadlockDetection;
  readonly configurationValidator: ConfigurationValidator;
  readonly diagnosticRuntime: DiagnosticRuntime;
  readonly runtimeDashboard: RuntimeDashboard;
  readonly workerDashboard: WorkerDashboard;
  readonly queueDashboard: QueueDashboard;
  readonly providerDashboard: ProviderDashboard;
  readonly distributionDashboard: DistributionDashboard;
  readonly royaltyDashboard: RoyaltyDashboard;
  readonly stateSyncDashboard: StateSyncDashboard;
  readonly systemDashboard: SystemDashboard;
  readonly runtimeStatistics: RuntimeStatistics;
  readonly runtimeMonitoringReporter: RuntimeMonitoringReporter;
  readonly healthReporter: HealthRuntimeReporter;
  readonly observabilityEventPublisher: ObservabilityEventPublisherFacade;
  readonly runtimeCounters: RuntimeCounters;
  readonly gauges: Gauges;
  readonly histograms: Histograms;
  readonly timers: Timers;
  readonly spanManager: SpanManager;
  readonly parentChildSpanResolver: ParentChildSpanResolver;
  readonly pipelineTraceBuilder: PipelineTraceBuilder;
  readonly runtimeTracePublisher: RuntimeTracePublisher;
  readonly readinessEngine: ReadinessEngine;
  readonly livenessEngine: LivenessEngine;
  readonly startupValidator: StartupValidator;
  readonly shutdownValidator: ShutdownValidator;
  readonly dependencyHealthAnalyzer: DependencyHealthAnalyzer;

  constructor(public readonly dependencies: ObservabilityRuntimeDependencies) {
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

  log(level: LogEntry["level"], message: string, source: string, metadata: ObservabilityMetadata = {}, traceId?: string | null, spanId?: string | null): LogEntry {
    const entry = this.logger.create(level, message, source, metadata, traceId, spanId);
    this.logRouter.route(entry);
    this.logAggregator.add(entry);
    return entry;
  }

  metric(name: string, value: number, tags: RuntimeTags = {}, metadata: ObservabilityMetadata = {}): Metric {
    const metric = this.metricsRuntime.create(name, value, metadata, tags);
    this.metricsRuntime.record(metric);
    return metric;
  }

  trace(name: string, source: string, subject: string, metadata: ObservabilityMetadata = {}): Trace {
    const trace = this.traceRuntime.create(name, source, subject, metadata);
    return trace;
  }

  health(componentId: string, category: HealthCategory, healthy: boolean, message?: string | null): HealthStatus {
    const status = this.healthRuntime.check(componentId, category, healthy, message);
    this.componentHealthRegistry.register(componentId, status);
    return status;
  }
}

export class ObservabilityEventPublisherFacade {
  private readonly events: ObservabilityEvent[] = [];

  publish(event: ObservabilityEvent): void {
    this.events.push(event);
  }

  list(): readonly ObservabilityEvent[] {
    return Object.freeze([...this.events]);
  }
}

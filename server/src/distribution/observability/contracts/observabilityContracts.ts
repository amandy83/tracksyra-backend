import type { LogEntry } from "../logging/logEntry";
import type { Metric } from "../metrics/metric";
import type { Trace } from "../tracing/trace";
import type { Span } from "../tracing/span";
import type { HealthStatus } from "../health/healthStatus";
import type { HealthCheck } from "../health/healthCheck";
import type { Alert } from "../alerts/alert";
import type { Incident } from "../incidents/incident";
import type { DiagnosticReport } from "../diagnostics/diagnosticReport";
import type { SLAReport } from "../sla/slaReport";
import type { MonitoringSnapshot } from "../monitoring/monitoringSnapshot";
import type { PerformanceSnapshot } from "../monitoring/performanceSnapshot";
import type { AuditEvent } from "../audit/auditEvent";
import type { RetentionPolicy } from "../retention/retentionPolicy";
import type { ObservabilityMetadata } from "../types/observabilityTypes";
import type { DashboardProjection } from "../dashboards/dashboardProjection";

export interface Logger {
  log(entry: LogEntry): Promise<void> | void;
  info?(message: string, context?: Readonly<Record<string, unknown>>): void;
  warn?(message: string, context?: Readonly<Record<string, unknown>>): void;
  error?(message: string, context?: Readonly<Record<string, unknown>>): void;
  debug?(message: string, context?: Readonly<Record<string, unknown>>): void;
}

export interface MetricsCollector {
  record(metric: Metric): Promise<void> | void;
}

export interface TraceCollector {
  record(trace: Trace | Span): Promise<void> | void;
}

export interface HealthChecker {
  check(componentId: string): Promise<HealthStatus> | HealthStatus;
}

export interface HealthRegistry {
  register(componentId: string, checker: HealthChecker): void;
  resolve(componentId: string): HealthChecker | null;
  list(): readonly string[];
}

export interface AlertManager {
  raise(alert: Alert): Promise<void> | void;
}

export interface IncidentManager {
  open(incident: Incident): Promise<void> | void;
  resolve(incident: Incident): Promise<void> | void;
}

export interface DiagnosticService {
  generate(scope: string): Promise<DiagnosticReport> | DiagnosticReport;
}

export interface AuditService {
  record(event: AuditEvent): Promise<void> | void;
}

export interface SLAService {
  evaluate(scope: string): Promise<SLAReport> | SLAReport;
}

export interface DashboardPublisher {
  publish(projection: DashboardProjection): Promise<void> | void;
}

export interface MonitoringReporter {
  report(snapshot: MonitoringSnapshot | PerformanceSnapshot): Promise<void> | void;
}

export interface RetentionManager {
  apply(policy: RetentionPolicy): Promise<void> | void;
}

export interface Profiler {
  snapshot(scope: string): Promise<PerformanceSnapshot> | PerformanceSnapshot;
}

export interface ObservabilityMetadataCarrier {
  readonly metadata: ObservabilityMetadata;
}

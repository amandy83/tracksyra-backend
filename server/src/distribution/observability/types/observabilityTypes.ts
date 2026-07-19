export type HealthCategory =
  | "Application"
  | "Queue"
  | "Workers"
  | "Providers"
  | "DSP Connectors"
  | "Payments"
  | "Royalty"
  | "Storage"
  | "Network";

export type MetricCategory =
  | "Latency"
  | "Throughput"
  | "Failures"
  | "Retries"
  | "Queue Depth"
  | "Worker Utilization"
  | "DSP Processing Time"
  | "Royalty Import"
  | "Payments"
  | "Notifications";

export type TraceCategory =
  | "Submission"
  | "Validation"
  | "Packaging"
  | "Upload"
  | "Provider Processing"
  | "Webhook"
  | "Status Sync"
  | "Royalty"
  | "Payment"
  | "Archive";

export type AlertLevel = "Info" | "Warning" | "Error" | "Critical";
export type IncidentLevel = "Minor" | "Major" | "Critical" | "Disaster";

export type ObservabilityEventType =
  | "HealthChanged"
  | "MetricRecorded"
  | "TraceCompleted"
  | "AlertRaised"
  | "IncidentOpened"
  | "IncidentResolved"
  | "SLAViolated"
  | "AuditRecorded";

export type ObservabilityMetadata = Readonly<Record<string, unknown>>;


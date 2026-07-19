export type WorkerLifecycleState =
  | "Created"
  | "Reserved"
  | "Started"
  | "Running"
  | "Checkpointing"
  | "Completed"
  | "Failed"
  | "Cancelled"
  | "Recovered";

export type WorkerFailureCategory = "Retryable" | "Recoverable" | "Manual Intervention" | "Fatal";

export type WorkerEventType =
  | "WorkerCreated"
  | "WorkerReserved"
  | "WorkerStarted"
  | "WorkerRunning"
  | "WorkerCheckpointCreated"
  | "WorkerRecovered"
  | "WorkerCancelled"
  | "WorkerCompleted"
  | "WorkerFailed"
  | "HeartbeatExpired"
  | "LeaseExpired";

export interface WorkerEvent {
  readonly type: WorkerEventType;
  readonly workerId: string;
  readonly executionId: string;
  readonly occurredAt: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface WorkerEventPublisher {
  publish(event: WorkerEvent): Promise<void> | void;
}


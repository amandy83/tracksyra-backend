import type { ExecutionCheckpoint, ExecutionPipelineName, ExecutionStageName } from "./types";

export type ExecutionEventType =
  | "ExecutionStarted"
  | "StageStarted"
  | "StageCompleted"
  | "CheckpointCreated"
  | "ExecutionPaused"
  | "ExecutionResumed"
  | "ExecutionCancelled"
  | "ExecutionRecovered"
  | "ExecutionCompleted"
  | "ExecutionFailed";

export interface ExecutionEvent {
  readonly type: ExecutionEventType;
  readonly executionId: string;
  readonly pipeline: ExecutionPipelineName | null;
  readonly stage: ExecutionStageName | null;
  readonly occurredAt: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface ExecutionEventPublisher {
  publish(event: ExecutionEvent): Promise<void> | void;
}

export function createExecutionEvent(
  type: ExecutionEventType,
  input: Omit<ExecutionEvent, "type">,
): ExecutionEvent {
  return Object.freeze({
    type,
    ...input,
    payload: Object.freeze({ ...input.payload }),
  });
}

export type ExecutionEventCheckpoint = ExecutionCheckpoint;


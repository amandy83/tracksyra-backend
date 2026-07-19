import type { QueueJob } from "../jobs/queueJob";
import type { QueuePriorityLevel, QueueRoutingPolicyName } from "../types/queueTypes";

export interface QueueRoutingPolicy {
  readonly name: QueueRoutingPolicyName;
  route(job: QueueJob): string;
}

export interface JobRouter {
  route(job: QueueJob): string;
}

export interface MessageRouter {
  route(messageType: string): string;
}

export interface StageRouter {
  route(stage: string): string;
}

export interface PipelineRouter {
  route(pipeline: string): string;
}


import type { WorkflowMetadata } from "../types/workflowTypes";

export class WorkflowNotificationFlow<TMetadata extends WorkflowMetadata = WorkflowMetadata> {
  readonly notificationId: string;
  readonly channels: readonly string[];
  readonly createdAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    notificationId: string;
    channels?: readonly string[];
    createdAt?: string;
    metadata?: TMetadata;
  }) {
    this.notificationId = input.notificationId.trim();
    this.channels = Object.freeze([...(input.channels ?? [])]);
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) }) as TMetadata;
    if (!this.notificationId) {
      throw new Error("WorkflowNotificationFlow.notificationId must not be empty");
    }
    Object.freeze(this);
  }
}

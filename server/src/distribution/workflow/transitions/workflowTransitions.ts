import type { WorkflowMetadata, WorkflowStageName } from "../types/workflowTypes";

export class WorkflowTransitionGraph<TMetadata extends WorkflowMetadata = WorkflowMetadata> {
  readonly graphId: string;
  readonly transitions: readonly Readonly<{
    from: WorkflowStageName;
    to: WorkflowStageName;
  }>[];
  readonly createdAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    graphId: string;
    transitions: readonly Readonly<{
      from: WorkflowStageName;
      to: WorkflowStageName;
    }>[];
    createdAt?: string;
    metadata?: TMetadata;
  }) {
    this.graphId = input.graphId.trim();
    this.transitions = Object.freeze([
      ...(input.transitions ?? []).map((transition) => Object.freeze({ ...transition })),
    ]);
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) }) as TMetadata;
    if (!this.graphId) {
      throw new Error("WorkflowTransitionGraph.graphId must not be empty");
    }
    Object.freeze(this);
  }
}

import type { WorkerRuntime } from "../contracts/workerRuntimeContracts";
import type { WorkerConfiguration, WorkerMetadata } from "../types/workerIntegrationTypes";

export class WorkerRegistryEntry<TMetadata extends WorkerMetadata = WorkerMetadata> {
  readonly workerId: string;
  readonly runtime: WorkerRuntime;
  readonly configuration: WorkerConfiguration<TMetadata>;
  readonly registeredAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    workerId: string;
    runtime: WorkerRuntime;
    configuration: WorkerConfiguration<TMetadata>;
    registeredAt?: string;
    metadata?: TMetadata;
  }) {
    this.workerId = input.workerId.trim();
    this.runtime = input.runtime;
    this.configuration = input.configuration;
    this.registeredAt = input.registeredAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) }) as TMetadata;
    if (!this.workerId) {
      throw new Error("WorkerRegistryEntry.workerId must not be empty");
    }
    Object.freeze(this);
  }
}

export interface WorkerRegistry {
  register(entry: WorkerRegistryEntry): void;
  resolve(workerId: string): WorkerRuntime | null;
  get(workerId: string): WorkerRegistryEntry | null;
  list(): readonly WorkerRegistryEntry[];
}

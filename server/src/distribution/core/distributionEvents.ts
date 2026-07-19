import { EventEmitter } from "node:events";
import type { DistributionContext } from "./distributionContext";
import type { DistributionError } from "./distributionError";
import type { DistributionJob } from "./distributionJob";
import type { DistributionPackage } from "./packageBuilder";
import type { DistributionResult } from "./distributionResult";

export type DistributionEventsMap = {
  "job:started": { job: DistributionJob; context: DistributionContext };
  "job:completed": { job: DistributionJob; context: DistributionContext; result: DistributionResult };
  "job:failed": { job: DistributionJob; context: DistributionContext; error: DistributionError; result: DistributionResult };
  "package:built": { job: DistributionJob; context: DistributionContext; package: DistributionPackage };
  "provider:resolved": { job: DistributionJob; context: DistributionContext; provider: string };
  "retry:scheduled": { job: DistributionJob; context: DistributionContext; error: DistributionError; retryAt: Date; attempt: number };
};

export class DistributionEvents extends EventEmitter {
  on<K extends keyof DistributionEventsMap>(eventName: K, listener: (payload: DistributionEventsMap[K]) => void): this {
    return super.on(eventName, listener);
  }

  once<K extends keyof DistributionEventsMap>(eventName: K, listener: (payload: DistributionEventsMap[K]) => void): this {
    return super.once(eventName, listener);
  }

  emit<K extends keyof DistributionEventsMap>(eventName: K, payload: DistributionEventsMap[K]): boolean {
    return super.emit(eventName, payload);
  }
}


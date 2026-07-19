import { randomUUID } from "node:crypto";
import type { IdempotencyKey, RequestFingerprint } from "../idempotency/idempotency";
import { LockLease, LockToken, type DistributedLock } from "../locking/locking";
import type { StorageMetadata, StorageOwnershipState } from "./storageTypes";

export interface LeaderRecord {
  readonly leaderId: string;
  readonly term: number;
  readonly electedAt: string;
  readonly expiresAt: string | null;
  readonly metadata: StorageMetadata;
}

export interface LeaseOwnershipRecord {
  readonly resource: string;
  readonly owner: string;
  readonly leaseId: string;
  readonly acquiredAt: string;
  readonly expiresAt: string;
  readonly metadata: StorageMetadata;
}

export interface WorkerOwnershipRecord {
  readonly workerId: string;
  readonly owner: string;
  readonly state: StorageOwnershipState;
  readonly leasedAt: string;
  readonly expiresAt: string | null;
  readonly metadata: StorageMetadata;
}

export interface ExecutionFenceRecord {
  readonly fenceId: string;
  readonly resource: string;
  readonly owner: string;
  readonly issuedAt: string;
  readonly metadata: StorageMetadata;
}

export interface ExecutionTokenRecord {
  readonly token: string;
  readonly resource: string;
  readonly owner: string;
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly metadata: StorageMetadata;
}

export interface DistributedLeaderElection {
  elect(resource: string, candidate: string, metadata?: StorageMetadata): LeaderRecord;
  current(resource: string): LeaderRecord | null;
}

export interface LeaseOwnership {
  claim(resource: string, owner: string, ttlMs: number, metadata?: StorageMetadata): LeaseOwnershipRecord | null;
  release(resource: string, leaseId: string): boolean;
  current(resource: string): LeaseOwnershipRecord | null;
}

export interface WorkerOwnership {
  claim(workerId: string, owner: string, ttlMs: number, metadata?: StorageMetadata): WorkerOwnershipRecord | null;
  release(workerId: string, owner: string): boolean;
  current(workerId: string): WorkerOwnershipRecord | null;
}

export interface ExecutionFencing {
  issue(resource: string, owner: string, metadata?: StorageMetadata): ExecutionFenceRecord;
  current(resource: string): ExecutionFenceRecord | null;
}

export interface DuplicateExecutionPrevention {
  has(key: IdempotencyKey): boolean;
  store(key: IdempotencyKey, fingerprint: RequestFingerprint): void;
  resolve(key: IdempotencyKey): RequestFingerprint | null;
}

export interface CheckpointOwnership {
  claim(checkpointId: string, owner: string, metadata?: StorageMetadata): LeaseOwnershipRecord | null;
  current(checkpointId: string): LeaseOwnershipRecord | null;
}

export interface RecoveryOwnership {
  claim(recoveryId: string, owner: string, metadata?: StorageMetadata): LeaseOwnershipRecord | null;
  current(recoveryId: string): LeaseOwnershipRecord | null;
}

export interface StaleLeaseDetection {
  isStale(resource: string): boolean;
}

export interface HeartbeatOwnership {
  beat(resource: string, owner: string, metadata?: StorageMetadata): LeaseOwnershipRecord;
  current(resource: string): LeaseOwnershipRecord | null;
}

export interface ExecutionTokenService {
  issue(resource: string, owner: string, ttlMs: number, metadata?: StorageMetadata): ExecutionTokenRecord;
  resolve(token: string): ExecutionTokenRecord | null;
  revoke(token: string): boolean;
}

export class DefaultDistributedLeaderElection implements DistributedLeaderElection {
  private readonly leaders = new Map<string, LeaderRecord>();

  elect(resource: string, candidate: string, metadata: StorageMetadata = {}): LeaderRecord {
    const current = this.leaders.get(resource);
    const leader = Object.freeze({
      leaderId: candidate,
      term: (current?.term ?? 0) + 1,
      electedAt: new Date().toISOString(),
      expiresAt: null,
      metadata: Object.freeze({ ...metadata }),
    });
    this.leaders.set(resource, leader);
    return leader;
  }

  current(resource: string): LeaderRecord | null {
    return this.leaders.get(resource) ?? null;
  }
}

export class DefaultLeaseOwnership implements LeaseOwnership {
  private readonly leases = new Map<string, LeaseOwnershipRecord>();

  claim(resource: string, owner: string, ttlMs: number, metadata: StorageMetadata = {}): LeaseOwnershipRecord | null {
    const current = this.leases.get(resource);
    if (current && new Date(current.expiresAt).getTime() > Date.now()) {
      return null;
    }
    const next = Object.freeze({
      resource,
      owner,
      leaseId: randomUUID(),
      acquiredAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      metadata: Object.freeze({ ...metadata }),
    });
    this.leases.set(resource, next);
    return next;
  }

  renew(resource: string, leaseId: string, ttlMs: number, metadata: StorageMetadata = {}): LeaseOwnershipRecord | null {
    const current = this.leases.get(resource);
    if (!current || current.leaseId !== leaseId) return null;
    const next = Object.freeze({
      resource,
      owner: current.owner,
      leaseId,
      acquiredAt: current.acquiredAt,
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      metadata: Object.freeze({ ...metadata }),
    });
    this.leases.set(resource, next);
    return next;
  }

  release(resource: string, leaseId: string): boolean {
    const current = this.leases.get(resource);
    if (!current || current.leaseId !== leaseId) return false;
    this.leases.delete(resource);
    return true;
  }

  current(resource: string): LeaseOwnershipRecord | null {
    return this.leases.get(resource) ?? null;
  }
}

export class DefaultWorkerOwnership implements WorkerOwnership {
  private readonly workers = new Map<string, WorkerOwnershipRecord>();

  claim(workerId: string, owner: string, ttlMs: number, metadata: StorageMetadata = {}): WorkerOwnershipRecord | null {
    const current = this.workers.get(workerId);
    if (current && current.state === "owned" && current.expiresAt && new Date(current.expiresAt).getTime() > Date.now()) {
      return null;
    }
    const next = Object.freeze({
      workerId,
      owner,
      state: "owned" as StorageOwnershipState,
      leasedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      metadata: Object.freeze({ ...metadata }),
    });
    this.workers.set(workerId, next);
    return next;
  }

  release(workerId: string, owner: string): boolean {
    const current = this.workers.get(workerId);
    if (!current || current.owner !== owner) return false;
    this.workers.delete(workerId);
    return true;
  }

  current(workerId: string): WorkerOwnershipRecord | null {
    return this.workers.get(workerId) ?? null;
  }
}

export class DefaultExecutionFencing implements ExecutionFencing {
  private readonly fences = new Map<string, ExecutionFenceRecord>();

  issue(resource: string, owner: string, metadata: StorageMetadata = {}): ExecutionFenceRecord {
    const fence = Object.freeze({
      fenceId: randomUUID(),
      resource,
      owner,
      issuedAt: new Date().toISOString(),
      metadata: Object.freeze({ ...metadata }),
    });
    this.fences.set(resource, fence);
    return fence;
  }

  current(resource: string): ExecutionFenceRecord | null {
    return this.fences.get(resource) ?? null;
  }
}

export class DefaultDuplicateExecutionPrevention implements DuplicateExecutionPrevention {
  private readonly fingerprints = new Map<string, RequestFingerprint>();

  has(key: IdempotencyKey): boolean {
    return this.fingerprints.has(key.value);
  }

  store(key: IdempotencyKey, fingerprint: RequestFingerprint): void {
    this.fingerprints.set(key.value, fingerprint);
  }

  resolve(key: IdempotencyKey): RequestFingerprint | null {
    return this.fingerprints.get(key.value) ?? null;
  }
}

export class DefaultCheckpointOwnership implements CheckpointOwnership {
  private readonly checkpoints = new Map<string, LeaseOwnershipRecord>();

  claim(checkpointId: string, owner: string, metadata: StorageMetadata = {}): LeaseOwnershipRecord | null {
    const current = this.checkpoints.get(checkpointId);
    if (current) return null;
    const record = Object.freeze({
      resource: checkpointId,
      owner,
      leaseId: randomUUID(),
      acquiredAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      metadata: Object.freeze({ ...metadata }),
    });
    this.checkpoints.set(checkpointId, record);
    return record;
  }

  current(checkpointId: string): LeaseOwnershipRecord | null {
    return this.checkpoints.get(checkpointId) ?? null;
  }
}

export class DefaultRecoveryOwnership implements RecoveryOwnership {
  private readonly recoveries = new Map<string, LeaseOwnershipRecord>();

  claim(recoveryId: string, owner: string, metadata: StorageMetadata = {}): LeaseOwnershipRecord | null {
    const current = this.recoveries.get(recoveryId);
    if (current) return null;
    const record = Object.freeze({
      resource: recoveryId,
      owner,
      leaseId: randomUUID(),
      acquiredAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      metadata: Object.freeze({ ...metadata }),
    });
    this.recoveries.set(recoveryId, record);
    return record;
  }

  current(recoveryId: string): LeaseOwnershipRecord | null {
    return this.recoveries.get(recoveryId) ?? null;
  }
}

export class DefaultStaleLeaseDetection implements StaleLeaseDetection {
  constructor(private readonly leases: LeaseOwnership) {}

  isStale(resource: string): boolean {
    const current = this.leases.current(resource);
    return Boolean(current && new Date(current.expiresAt).getTime() <= Date.now());
  }
}

export class DefaultHeartbeatOwnership implements HeartbeatOwnership {
  private readonly heartbeats = new Map<string, LeaseOwnershipRecord>();

  beat(resource: string, owner: string, metadata: StorageMetadata = {}): LeaseOwnershipRecord {
    const record = Object.freeze({
      resource,
      owner,
      leaseId: randomUUID(),
      acquiredAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
      metadata: Object.freeze({ ...metadata }),
    });
    this.heartbeats.set(resource, record);
    return record;
  }

  current(resource: string): LeaseOwnershipRecord | null {
    return this.heartbeats.get(resource) ?? null;
  }
}

export class DefaultExecutionTokenService implements ExecutionTokenService {
  private readonly tokens = new Map<string, ExecutionTokenRecord>();

  issue(resource: string, owner: string, ttlMs: number, metadata: StorageMetadata = {}): ExecutionTokenRecord {
    const token = Object.freeze({
      token: randomUUID(),
      resource,
      owner,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      metadata: Object.freeze({ ...metadata }),
    });
    this.tokens.set(token.token, token);
    return token;
  }

  resolve(token: string): ExecutionTokenRecord | null {
    return this.tokens.get(token) ?? null;
  }

  revoke(token: string): boolean {
    return this.tokens.delete(token);
  }
}

export interface DistributedCoordinationBundle {
  readonly lock: DistributedLock;
  readonly leaderElection: DistributedLeaderElection;
  readonly leaseOwnership: LeaseOwnership;
  readonly workerOwnership: WorkerOwnership;
  readonly fencing: ExecutionFencing;
  readonly duplicateExecutionPrevention: DuplicateExecutionPrevention;
  readonly checkpointOwnership: CheckpointOwnership;
  readonly recoveryOwnership: RecoveryOwnership;
  readonly staleLeaseDetection: StaleLeaseDetection;
  readonly heartbeatOwnership: HeartbeatOwnership;
  readonly executionTokens: ExecutionTokenService;
}

export function createDefaultDistributedCoordinationBundle(bundle: DistributedCoordinationBundle): DistributedCoordinationBundle {
  return bundle;
}

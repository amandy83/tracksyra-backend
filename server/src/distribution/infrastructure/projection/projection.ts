import type { DistributionDomainEvent } from "../../domain";
import type { DocumentStore } from "../shared/documentStore";

export interface EventProjection {
  project(event: DistributionDomainEvent): Promise<void> | void;
}

type ProjectionEnvelope = Readonly<{
  aggregateId: string;
  aggregateType: string;
  lastEventType: string;
  lastOccurredAt: string;
  lastPayload: Readonly<Record<string, unknown>>;
  eventCount: number;
}>;

type TimelineEntry = Readonly<{
  type: string;
  occurredAt: string;
  payload: Readonly<Record<string, unknown>>;
}>;

function projectionKey(event: DistributionDomainEvent): string {
  const payload = event.payload as Readonly<Record<string, unknown>>;
  const releaseId = typeof payload.releaseId === "string" ? payload.releaseId : null;
  const identifier = releaseId ?? event.aggregateId;
  return identifier.replace(/[^A-Za-z0-9._-]/g, "_");
}

function asRecord(payload: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return { ...payload };
}

export class DistributionProjection implements EventProjection {
  constructor(private readonly store: DocumentStore) {}

  async project(event: DistributionDomainEvent): Promise<void> {
    const key = `projections/distribution/${projectionKey(event)}.json`;
    const current = (await this.store.read<ProjectionEnvelope>(key)) ?? {
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      lastEventType: event.type,
      lastOccurredAt: event.occurredAt,
      lastPayload: asRecord(event.payload),
      eventCount: 0,
    };

    const next: ProjectionEnvelope = {
      aggregateId: current.aggregateId,
      aggregateType: current.aggregateType,
      lastEventType: event.type,
      lastOccurredAt: event.occurredAt,
      lastPayload: asRecord(event.payload),
      eventCount: current.eventCount + 1,
    };

    await this.store.write(key, next);
  }
}

export class TimelineProjection implements EventProjection {
  constructor(private readonly store: DocumentStore) {}

  async project(event: DistributionDomainEvent): Promise<void> {
    const key = `projections/timeline/${projectionKey(event)}.json`;
    const current = (await this.store.read<readonly TimelineEntry[]>(key)) ?? [];
    const next: readonly TimelineEntry[] = [
      ...current,
      {
        type: event.type,
        occurredAt: event.occurredAt,
        payload: asRecord(event.payload),
      },
    ];
    await this.store.write(key, next);
  }
}

type DashboardProjectionSnapshot = Readonly<{
  releaseId: string;
  status: string;
  updatedAt: string;
  lastEventType: string;
  summary: Readonly<Record<string, unknown>>;
}>;

export class DashboardProjection implements EventProjection {
  constructor(private readonly store: DocumentStore) {}

  async project(event: DistributionDomainEvent): Promise<void> {
    const payload = event.payload as Readonly<Record<string, unknown>>;
    const releaseId = typeof payload.releaseId === "string" ? payload.releaseId : event.aggregateId;
    const key = `projections/dashboard/${projectionKey(event)}.json`;
    const current = (await this.store.read<DashboardProjectionSnapshot>(key)) ?? {
      releaseId,
      status: event.aggregateType,
      updatedAt: event.occurredAt,
      lastEventType: event.type,
      summary: {},
    };

    const next: DashboardProjectionSnapshot = {
      releaseId: current.releaseId,
      status: current.status,
      updatedAt: event.occurredAt,
      lastEventType: event.type,
      summary: {
        ...current.summary,
        [event.type]: asRecord(event.payload),
      },
    };

    await this.store.write(key, next);
  }
}

export class ProjectionUpdater {
  private readonly projections: EventProjection[];

  constructor(projections: readonly EventProjection[] = []) {
    this.projections = [...projections];
  }

  register(projection: EventProjection): void {
    this.projections.push(projection);
  }

  async update(event: DistributionDomainEvent): Promise<void> {
    for (const projection of this.projections) {
      await projection.project(event);
    }
  }
}

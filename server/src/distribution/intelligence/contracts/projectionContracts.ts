import type { DistributionDomainEvent } from "../../domain";
import type { DistributionProjection } from "../projection/distributionProjection";
import type { ReleaseProjection } from "../projection/releaseProjection";
import type { DashboardProjection } from "../dashboard/dashboardProjection";
import type { TimelineEntry } from "../timeline/timelineEntry";
import type { AnalyticsSnapshot } from "../snapshots/analyticsSnapshot";
import type { ProjectionCheckpoint } from "../snapshots/projectionCheckpoint";
import type { AuditRecord } from "../audit/auditRecord";
import type { SearchResult } from "../search/searchResult";
import type { DistributionStatistics } from "../statistics/distributionStatistics";

export interface ProjectionEngine {
  build(event: DistributionDomainEvent): Promise<ProjectionResult> | ProjectionResult;
  rebuild(releaseId: string): Promise<ProjectionResult> | ProjectionResult;
  replay(releaseId: string, events: readonly DistributionDomainEvent[]): Promise<ProjectionResult> | ProjectionResult;
}

export interface ProjectionRegistry {
  register(projection: DistributionProjection | ReleaseProjection | DashboardProjection): void;
  resolve(releaseId: string): DistributionProjection | ReleaseProjection | DashboardProjection | null;
}

export interface ProjectionBuilder {
  build(events: readonly DistributionDomainEvent[]): ProjectionResult;
}

export interface ProjectionUpdater {
  update(result: ProjectionResult): Promise<void> | void;
}

export interface TimelineBuilder {
  build(events: readonly DistributionDomainEvent[]): readonly TimelineEntry[];
}

export interface DashboardBuilder {
  build(projected: DistributionProjection | ReleaseProjection): DashboardProjection;
}

export interface AnalyticsBuilder {
  build(events: readonly DistributionDomainEvent[]): AnalyticsSnapshot;
}

export interface HistoryBuilder {
  build(events: readonly DistributionDomainEvent[]): readonly AuditRecord[];
}

export interface AuditBuilder {
  build(event: DistributionDomainEvent): AuditRecord;
}

export interface SnapshotBuilder {
  build(result: ProjectionResult): ProjectionCheckpoint;
}

export interface SearchProvider {
  search(query: string): Promise<readonly SearchResult[]> | readonly SearchResult[];
}

export interface AggregationProvider {
  aggregate(events: readonly DistributionDomainEvent[]): DistributionStatistics;
}

export interface ProjectionMetrics {
  increment(metric: string, value?: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
  observe(metric: string, value: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
}

export interface ProjectionLogger {
  debug(message: string, context?: Readonly<Record<string, unknown>>): void;
  info(message: string, context?: Readonly<Record<string, unknown>>): void;
  warn(message: string, context?: Readonly<Record<string, unknown>>): void;
  error(message: string, context?: Readonly<Record<string, unknown>>): void;
}

export class ProjectionResult {
  readonly releaseId: string;
  readonly success: boolean;
  readonly projection: DistributionProjection | ReleaseProjection | DashboardProjection | null;
  readonly timeline: readonly TimelineEntry[];
  readonly analytics: AnalyticsSnapshot | null;
  readonly checkpoint: ProjectionCheckpoint | null;
  readonly audit: readonly AuditRecord[];
  readonly search: readonly SearchResult[];
  readonly metadata: Readonly<Record<string, unknown>>;

  constructor(input: {
    releaseId: string;
    success: boolean;
    projection?: DistributionProjection | ReleaseProjection | DashboardProjection | null;
    timeline?: readonly TimelineEntry[];
    analytics?: AnalyticsSnapshot | null;
    checkpoint?: ProjectionCheckpoint | null;
    audit?: readonly AuditRecord[];
    search?: readonly SearchResult[];
    metadata?: Readonly<Record<string, unknown>>;
  }) {
    this.releaseId = input.releaseId.trim();
    this.success = input.success;
    this.projection = input.projection ?? null;
    this.timeline = Object.freeze([...(input.timeline ?? [])]);
    this.analytics = input.analytics ?? null;
    this.checkpoint = input.checkpoint ?? null;
    this.audit = Object.freeze([...(input.audit ?? [])]);
    this.search = Object.freeze([...(input.search ?? [])]);
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.releaseId) {
      throw new Error("ProjectionResult.releaseId must not be empty");
    }
    Object.freeze(this);
  }
}


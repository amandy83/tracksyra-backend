import type { ReconciliationResult } from "../reconciliation/reconciliationResult";
import type { WebhookEvent, WebhookProcessor } from "../webhooks/webhookEvent";
import type { PollingProcessor, PollingResult } from "../polling/pollingResult";
import type { StatusNormalizer } from "../normalization/normalizedStatus";
import type { StatusMapper } from "../mapping/statusMapper";
import type { TransitionValidator } from "../validation/transitionValidation";
import type { ReconciliationEngine } from "../reconciliation/reconciliationResult";
import type { ConflictResolver } from "../conflict/conflictResolution";
import type { ProjectionUpdater } from "../projection/statusProjection";
import type { TimelineUpdater } from "../timeline/statusTimeline";
import type { StatusScheduler } from "../scheduler/statusScheduler";
import type { StatusMetrics } from "../metrics/statusMetrics";
import type { StatusLogger } from "../logging/statusLogger";
import type { StatusSnapshot } from "../snapshot/statusSnapshot";

export interface StatusSyncEngine {
  synchronize(input: {
    webhook?: WebhookEvent | null;
    polling?: PollingResult | null;
    snapshot: StatusSnapshot;
  }): Promise<ReconciliationResult>;
}

export {
  WebhookProcessor,
  PollingProcessor,
  StatusNormalizer,
  StatusMapper,
  TransitionValidator,
  ReconciliationEngine,
  ConflictResolver,
  ProjectionUpdater,
  TimelineUpdater,
  StatusScheduler,
  StatusMetrics,
  StatusLogger,
};


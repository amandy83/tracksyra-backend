import type { DistributionOrchestrator } from "../application/services";
import type { StatusSnapshot } from "./snapshot/statusSnapshot";
import type { NormalizedStatus } from "./normalization/normalizedStatus";
import { ProviderStatusEvent } from "./events/providerStatusEvent";
import type { PollingResult } from "./polling/pollingResult";
import { ReconciliationResult } from "./reconciliation/reconciliationResult";
import type { StatusSyncEngine } from "./contracts/statusSyncEngine";
import { WebhookEvent } from "./webhooks/webhookEvent";
import { StatusTransition } from "./types/statusTypes";
import { ReleaseId } from "../domain";

function normalizeRawStatus(snapshot: StatusSnapshot, webhook?: WebhookEvent | null, polling?: PollingResult | null): string {
  return webhook?.providerStatusEvent.providerStatus ?? polling?.snapshot.current.rawStatus ?? snapshot.current.rawStatus;
}

function normalizeSource(webhook?: WebhookEvent | null, polling?: PollingResult | null): "WEBHOOK" | "POLLING" {
  return webhook ? "WEBHOOK" : "POLLING";
}

export class DistributionStatusSyncEngineBridge implements StatusSyncEngine {
  constructor(private readonly orchestrator: DistributionOrchestrator) {}

  async synchronize(input: {
    webhook?: WebhookEvent | null;
    polling?: PollingResult | null;
    snapshot: StatusSnapshot;
  }): Promise<ReconciliationResult> {
    const source = normalizeSource(input.webhook, input.polling);
    const rawStatus = normalizeRawStatus(input.snapshot, input.webhook, input.polling);
    const normalizedStatus = input.snapshot.current;
    const transition = new StatusTransition({
      releaseId: input.snapshot.releaseId,
      from: input.snapshot.previous?.canonicalState ?? null,
      to: normalizedStatus.canonicalState,
      source,
      reason: rawStatus,
      metadata: {
        providerReference: input.snapshot.providerReference,
        providerStatus: rawStatus,
      },
    });

    await this.orchestrator.syncStatus({
      releaseId: new ReleaseId(input.snapshot.releaseId),
      requestedBy: source.toLowerCase(),
    });

    return new ReconciliationResult({
      releaseId: input.snapshot.releaseId,
      success: true,
      snapshot: input.snapshot,
      normalizedStatus: normalizedStatus as NormalizedStatus,
      transition,
      conflictResolution: null,
      warnings: [],
      errors: [],
      reconciledAt: new Date().toISOString(),
      metadata: {
        source,
      },
    });
  }
}

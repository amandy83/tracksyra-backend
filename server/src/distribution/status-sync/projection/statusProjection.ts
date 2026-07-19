import { ReconciliationResult } from "../reconciliation/reconciliationResult";

export interface ProjectionUpdater {
  update(result: ReconciliationResult): Promise<void> | void;
}


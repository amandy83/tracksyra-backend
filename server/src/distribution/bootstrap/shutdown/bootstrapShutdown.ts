import type { BootstrapReport, ShutdownSequence } from "../types/bootstrapTypes";

export interface BootstrapShutdownCoordinator {
  coordinate(sequence: ShutdownSequence): Promise<BootstrapReport> | BootstrapReport;
}

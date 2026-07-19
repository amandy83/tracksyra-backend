import type { DistributionState } from "../../domain";
import { ProviderStatusEvent } from "../events/providerStatusEvent";
import { NormalizedStatus } from "../normalization/normalizedStatus";

export interface StatusMapper {
  map(event: ProviderStatusEvent): NormalizedStatus;
  resolveCanonicalStatus(rawStatus: string): DistributionState;
}


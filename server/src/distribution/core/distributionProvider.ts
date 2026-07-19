import type { DistributionContext } from "./distributionContext";
import type { DistributionPackage } from "./packageBuilder";
import type { DistributionResult } from "./distributionResult";

export type DistributionProviderSubmission = {
  status: DistributionResult["status"];
  providerReferenceId?: string | null;
  rawResponse?: unknown;
  metadata?: Record<string, unknown>;
};

export interface DistributionProvider {
  readonly name: string;
  supports(context: DistributionContext): boolean;
  submit(input: DistributionPackage, context: DistributionContext): Promise<DistributionProviderSubmission>;
}


import type { ReleaseId } from "../domain";
import type {
  DistributionStatusResponse,
  PaymentResponse,
  ProviderSubmissionResponse,
  RoyaltyResponse,
  TimelineResponse,
} from "./dtos";
import type { DistributionApplicationDependencies } from "./dependencyTypes";

async function resolve<T>(value: Promise<T> | T): Promise<T> {
  return await Promise.resolve(value);
}

export class GetDistributionStatus {
  constructor(private readonly deps: DistributionApplicationDependencies) {}

  async execute(releaseId: ReleaseId): Promise<DistributionStatusResponse> {
    const result = await resolve(this.deps.queries.getReleaseView(releaseId));
    if (!result) throw new Error(`Distribution status not found for ${releaseId.value}`);
    return result as unknown as DistributionStatusResponse;
  }
}

export class GetTimeline {
  constructor(private readonly deps: DistributionApplicationDependencies) {}

  async execute(releaseId: ReleaseId): Promise<TimelineResponse> {
    const events = await resolve(this.deps.queries.getTimeline(releaseId));
    return { releaseId, events };
  }
}

export class GetProviderSubmission {
  constructor(private readonly deps: DistributionApplicationDependencies) {}

  async execute(releaseId: ReleaseId): Promise<ProviderSubmissionResponse> {
    const result = await resolve(this.deps.queries.getProviderSubmission(releaseId));
    if (!result) throw new Error(`Provider submission not found for ${releaseId.value}`);
    return result as unknown as ProviderSubmissionResponse;
  }
}

export class GetRoyaltySummary {
  constructor(private readonly deps: DistributionApplicationDependencies) {}

  async execute(releaseId: ReleaseId): Promise<RoyaltyResponse> {
    const result = await resolve(this.deps.queries.getRoyaltySummary(releaseId));
    if (!result) throw new Error(`Royalty summary not found for ${releaseId.value}`);
    return result as unknown as RoyaltyResponse;
  }
}

export class GetPaymentStatus {
  constructor(private readonly deps: DistributionApplicationDependencies) {}

  async execute(releaseId: ReleaseId): Promise<PaymentResponse> {
    const result = await resolve(this.deps.queries.getPaymentSummary(releaseId));
    if (!result) throw new Error(`Payment status not found for ${releaseId.value}`);
    return result as unknown as PaymentResponse;
  }
}

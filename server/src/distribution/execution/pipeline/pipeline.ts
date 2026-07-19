import type { ExecutionPipeline as ExecutionPipelineInterface, ExecutionPipelineName, ExecutionStageName } from "../types";

export class ExecutionPipeline implements ExecutionPipelineInterface {
  readonly name: ExecutionPipelineName;
  readonly stages: readonly ExecutionStageName[];

  constructor(input: { name: ExecutionPipelineName; stages: readonly ExecutionStageName[] }) {
    this.name = input.name;
    this.stages = Object.freeze([...(input.stages ?? [])]);
    Object.freeze(this);
  }
}

abstract class AbstractPipeline extends ExecutionPipeline {}

export class SubmissionPipeline extends AbstractPipeline {
  constructor() {
    super({ name: "SubmissionPipeline", stages: ["Submission", "SubmissionLock"] });
  }
}

export class ValidationPipeline extends AbstractPipeline {
  constructor() {
    super({ name: "ValidationPipeline", stages: ["Snapshot", "Validation"] });
  }
}

export class ApprovalPipeline extends AbstractPipeline {
  constructor() {
    super({ name: "ApprovalPipeline", stages: ["Approval"] });
  }
}

export class MetadataPipeline extends AbstractPipeline {
  constructor() {
    super({ name: "MetadataPipeline", stages: ["MetadataGeneration"] });
  }
}

export class PackagingPipeline extends AbstractPipeline {
  constructor() {
    super({ name: "PackagingPipeline", stages: ["PackageBuild"] });
  }
}

export class VerificationPipeline extends AbstractPipeline {
  constructor() {
    super({ name: "VerificationPipeline", stages: ["PackageVerification"] });
  }
}

export class ProviderSelectionPipeline extends AbstractPipeline {
  constructor() {
    super({ name: "ProviderSelectionPipeline", stages: ["ProviderResolution"] });
  }
}

export class AuthenticationPipeline extends AbstractPipeline {
  constructor() {
    super({ name: "AuthenticationPipeline", stages: ["ProviderAuthentication"] });
  }
}

export class UploadPipeline extends AbstractPipeline {
  constructor() {
    super({ name: "UploadPipeline", stages: ["PackageUpload"] });
  }
}

export class ProviderProcessingPipeline extends AbstractPipeline {
  constructor() {
    super({ name: "ProviderProcessingPipeline", stages: ["ProviderProcessing"] });
  }
}

export class StatusPipeline extends AbstractPipeline {
  constructor() {
    super({ name: "StatusPipeline", stages: ["StatusNormalization", "StateTransition"] });
  }
}

export class DashboardPipeline extends AbstractPipeline {
  constructor() {
    super({ name: "DashboardPipeline", stages: ["DashboardProjection"] });
  }
}

export class NotificationPipeline extends AbstractPipeline {
  constructor() {
    super({ name: "NotificationPipeline", stages: ["NotificationDispatch"] });
  }
}

export class RoyaltyPipeline extends AbstractPipeline {
  constructor() {
    super({ name: "RoyaltyPipeline", stages: ["CatalogActivation", "RoyaltyImport", "RevenueCalculation"] });
  }
}

export class PaymentPipeline extends AbstractPipeline {
  constructor() {
    super({ name: "PaymentPipeline", stages: ["PaymentProcessing", "StatementGeneration"] });
  }
}

export class ArchivePipeline extends AbstractPipeline {
  constructor() {
    super({ name: "ArchivePipeline", stages: ["Archive"] });
  }
}


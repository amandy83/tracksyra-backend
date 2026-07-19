import type {
  ApplicationEventPublisher,
  ArtistDashboardPort,
  AudioQcPort,
  ApprovalWorkflowPort,
  ArtworkQcPort,
  DistributionPorts,
  DistributionQueryPort,
  IsrcManagementPort,
  MetadataEnginePort,
  MetadataValidationPort,
  NotificationSystemPort,
  PackagingEnginePort,
  PaymentSystemPort,
  ProviderFrameworkPort,
  RightsValidationPort,
  UpcManagementPort,
} from "./applicationTypes";

export type DistributionApplicationDependencies = Readonly<DistributionPorts & {
  metadataValidation: MetadataValidationPort;
  audioQc: AudioQcPort;
  artworkQc: ArtworkQcPort;
  rightsValidation: RightsValidationPort;
  isrcManagement: IsrcManagementPort;
  upcManagement: UpcManagementPort;
  approvalWorkflow: ApprovalWorkflowPort;
  metadataEngine: MetadataEnginePort;
  packagingEngine: PackagingEnginePort;
  providerFramework: ProviderFrameworkPort;
  paymentSystem: PaymentSystemPort;
  notificationSystem: NotificationSystemPort;
  artistDashboard: ArtistDashboardPort;
  queries: DistributionQueryPort;
  eventsPublisher: ApplicationEventPublisher;
}>;


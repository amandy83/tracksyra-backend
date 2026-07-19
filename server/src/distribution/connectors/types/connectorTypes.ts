export type ConnectorAuthenticationType =
  | "OAuth2"
  | "API Key"
  | "JWT"
  | "Bearer Token"
  | "Client Credentials"
  | "PKCE";

export type ConnectorUploadMode =
  | "Single Upload"
  | "Multipart Upload"
  | "Chunk Upload"
  | "Resumable Upload"
  | "Streaming Upload";

export type ConnectorStatusCategory =
  | "Accepted"
  | "Rejected"
  | "Processing"
  | "Pending"
  | "Scheduled"
  | "Live"
  | "Removed"
  | "Failed";

export type ConnectorRoyaltyFeature =
  | "Sales Reports"
  | "Streaming Reports"
  | "Usage Reports"
  | "Settlement Reports"
  | "Revenue Reports";

export type ConnectorCapabilityCategory =
  | "Music"
  | "Video"
  | "Lyrics"
  | "Dolby Atmos"
  | "Spatial Audio"
  | "Pre-save"
  | "Instant Gratification"
  | "Territories"
  | "Languages"
  | "Monetization"
  | "Royalty Reporting";

export type ConnectorEventType =
  | "ConnectorRegistered"
  | "ConnectorAuthenticated"
  | "UploadStarted"
  | "UploadCompleted"
  | "SubmissionAccepted"
  | "SubmissionRejected"
  | "StatusChanged"
  | "RoyaltyImported"
  | "ReportGenerated"
  | "HealthChanged";

export type ConnectorHeaderMap = Readonly<Record<string, string>>;
export type ConnectorAttributeMap = Readonly<Record<string, string | number | boolean | null>>;
export type ConnectorMetadataMap = Readonly<Record<string, unknown>>;


export enum ProviderStatus {
  INITIALIZING = "INITIALIZING",
  READY = "READY",
  DEGRADED = "DEGRADED",
  DISABLED = "DISABLED",
  AUTH_REQUIRED = "AUTH_REQUIRED",
  CONFIGURATION_REQUIRED = "CONFIGURATION_REQUIRED",
  UNAVAILABLE = "UNAVAILABLE",
  ERROR = "ERROR",
}

export enum ProviderLifecycleStage {
  CREATED = "CREATED",
  REGISTERED = "REGISTERED",
  INITIALIZED = "INITIALIZED",
  AUTHENTICATED = "AUTHENTICATED",
  READY = "READY",
  DEGRADED = "DEGRADED",
  DISCONNECTED = "DISCONNECTED",
  ERROR = "ERROR",
}

export const PROVIDER_STATUS_VALUES = Object.freeze(Object.values(ProviderStatus));

export function isProviderStatus(value: string): value is ProviderStatus {
  return PROVIDER_STATUS_VALUES.includes(value as ProviderStatus);
}


export var ProviderStatus;
(function (ProviderStatus) {
    ProviderStatus["INITIALIZING"] = "INITIALIZING";
    ProviderStatus["READY"] = "READY";
    ProviderStatus["DEGRADED"] = "DEGRADED";
    ProviderStatus["DISABLED"] = "DISABLED";
    ProviderStatus["AUTH_REQUIRED"] = "AUTH_REQUIRED";
    ProviderStatus["CONFIGURATION_REQUIRED"] = "CONFIGURATION_REQUIRED";
    ProviderStatus["UNAVAILABLE"] = "UNAVAILABLE";
    ProviderStatus["ERROR"] = "ERROR";
})(ProviderStatus || (ProviderStatus = {}));
export var ProviderLifecycleStage;
(function (ProviderLifecycleStage) {
    ProviderLifecycleStage["CREATED"] = "CREATED";
    ProviderLifecycleStage["REGISTERED"] = "REGISTERED";
    ProviderLifecycleStage["INITIALIZED"] = "INITIALIZED";
    ProviderLifecycleStage["AUTHENTICATED"] = "AUTHENTICATED";
    ProviderLifecycleStage["READY"] = "READY";
    ProviderLifecycleStage["DEGRADED"] = "DEGRADED";
    ProviderLifecycleStage["DISCONNECTED"] = "DISCONNECTED";
    ProviderLifecycleStage["ERROR"] = "ERROR";
})(ProviderLifecycleStage || (ProviderLifecycleStage = {}));
export const PROVIDER_STATUS_VALUES = Object.freeze(Object.values(ProviderStatus));
export function isProviderStatus(value) {
    return PROVIDER_STATUS_VALUES.includes(value);
}

import { ProviderError } from "./providerError.js";
export class ProviderValidator {
    validateConfiguration(configuration) {
        const issues = [];
        if (!configuration.provider.trim())
            issues.push(issue("provider", "INVALID_CONFIGURATION", "provider is required"));
        if (!configuration.version.trim())
            issues.push(issue("version", "INVALID_CONFIGURATION", "version is required"));
        if (configuration.priority < 0)
            issues.push(issue("priority", "INVALID_CONFIGURATION", "priority cannot be negative"));
        if (!Number.isFinite(configuration.timeoutMs) || configuration.timeoutMs <= 0) {
            issues.push(issue("timeoutMs", "INVALID_CONFIGURATION", "timeoutMs must be greater than zero"));
        }
        if (!Number.isFinite(configuration.healthCheckIntervalMs) || configuration.healthCheckIntervalMs <= 0) {
            issues.push(issue("healthCheckIntervalMs", "INVALID_CONFIGURATION", "healthCheckIntervalMs must be greater than zero"));
        }
        return report(issues, { provider: configuration.provider, version: configuration.version });
    }
    validateCredentials(credentials) {
        if (!credentials)
            return report([issue("credentials", "INVALID_CREDENTIALS", "credentials are required")]);
        const issues = [];
        if (!credentials.credentialId.trim())
            issues.push(issue("credentialId", "INVALID_CREDENTIALS", "credentialId is required"));
        if (!credentials.provider.trim())
            issues.push(issue("provider", "INVALID_CREDENTIALS", "provider is required"));
        if (!credentials.version.trim())
            issues.push(issue("version", "INVALID_CREDENTIALS", "version is required"));
        return report(issues, { provider: credentials.provider, version: credentials.version });
    }
    validateCapabilities(capabilities) {
        const issues = [];
        if (capabilities.operations.length === 0)
            issues.push(issue("operations", "INVALID_CONFIGURATION", "at least one operation is required"));
        if (capabilities.supportedStatuses.length === 0)
            issues.push(issue("supportedStatuses", "INVALID_CONFIGURATION", "supportedStatuses is required"));
        return report(issues);
    }
    validateManifest(manifest) {
        if (!manifest)
            return report([issue("manifest", "INVALID_MANIFEST", "manifest is required")]);
        const issues = [];
        if (!manifest.id.trim())
            issues.push(issue("id", "INVALID_MANIFEST", "id is required"));
        if (!manifest.provider.trim())
            issues.push(issue("provider", "INVALID_MANIFEST", "provider is required"));
        if (!manifest.version.trim())
            issues.push(issue("version", "INVALID_MANIFEST", "version is required"));
        if (!manifest.releaseId.trim())
            issues.push(issue("releaseId", "INVALID_MANIFEST", "releaseId is required"));
        if (!Number.isFinite(manifest.priority) || manifest.priority < 0)
            issues.push(issue("priority", "INVALID_MANIFEST", "priority must be zero or greater"));
        if (!manifest.checksum.trim())
            issues.push(issue("checksum", "INVALID_MANIFEST", "checksum is required"));
        return report(issues, { provider: manifest.provider, version: manifest.version });
    }
    validateContext(context) {
        if (!context)
            return report([issue("context", "INVALID_CONTEXT", "context is required")]);
        const issues = [];
        if (!context.provider.trim())
            issues.push(issue("provider", "INVALID_CONTEXT", "provider is required"));
        if (!context.version.trim())
            issues.push(issue("version", "INVALID_CONTEXT", "version is required"));
        if (!context.configuration)
            issues.push(issue("configuration", "INVALID_CONTEXT", "configuration is required"));
        if (!context.capabilities)
            issues.push(issue("capabilities", "INVALID_CONTEXT", "capabilities are required"));
        return report(issues, { provider: context.provider, version: context.version });
    }
    validateRequirements(requirements, value, scope) {
        const issues = [];
        const input = value ?? {};
        for (const requirement of requirements.required) {
            if (!(requirement.path in input) || input[requirement.path] == null) {
                issues.push(issue(`${scope}.${requirement.path}`, "VALIDATION_FAILED", requirement.description ?? `${requirement.path} is required`));
            }
        }
        for (const forbidden of requirements.forbidden) {
            if (forbidden in input && input[forbidden] != null) {
                issues.push(issue(`${scope}.${forbidden}`, "VALIDATION_FAILED", `${forbidden} must not be set`));
            }
        }
        return report(issues, requirements.metadata);
    }
    assertValid(report, provider, version) {
        if (report.valid)
            return;
        throw new ProviderError({
            code: "VALIDATION_FAILED",
            message: report.issues.map((entry) => entry.message).join("; "),
            provider,
            version: version ?? null,
            retryable: false,
            metadata: { issues: report.issues, ...report.metadata },
        });
    }
    ensureProvider(entry) {
        return this.validateCapabilities(entry.capabilities);
    }
}
function issue(path, code, message, severity = "error") {
    return { path, code, message, severity };
}
function report(issues, metadata = {}) {
    return {
        valid: issues.length === 0,
        issues: Object.freeze(issues),
        metadata: Object.freeze({ ...metadata }),
    };
}

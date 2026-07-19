import { DomainInvariantError } from "./domainErrors.js";
import { ensure, normalizePositiveInteger } from "./domainHelpers.js";
import { DistributionStateMachine } from "./distributionState.js";
export class SubmissionPolicy {
    canSubmit(state, hasLock, hasSnapshot) {
        return state === "DRAFT" && !hasLock && !hasSnapshot;
    }
    assertCanSubmit(state, hasLock, hasSnapshot) {
        if (!this.canSubmit(state, hasLock, hasSnapshot)) {
            throw new DomainInvariantError("Release cannot be submitted in the current state", { state, hasLock, hasSnapshot });
        }
    }
}
export class DistributionPolicy {
    stateMachine = new DistributionStateMachine();
    canAdvance(previous, next) {
        return this.stateMachine.canTransition(previous, next);
    }
    assertAdvance(previous, next) {
        this.stateMachine.assertTransition(previous, next);
    }
}
export class VersionPolicy {
    nextReleaseVersion(current) {
        if (!current)
            return "1.0.0";
        const parts = current.split(".").map((part) => Number.parseInt(part, 10));
        if (parts.some((part) => !Number.isInteger(part) || part < 0)) {
            throw new DomainInvariantError("Release version must be dot-separated integers", { current });
        }
        while (parts.length < 3)
            parts.push(0);
        parts[2] += 1;
        return parts.join(".");
    }
}
export class PackagePolicy {
    assertPackageReady(packageModel) {
        ensure(packageModel.artifacts.length > 0, "Package must contain at least one artifact", { fingerprint: packageModel.fingerprint.value });
        ensure(packageModel.manifestChecksum != null, "Package must include manifest checksum", { fingerprint: packageModel.fingerprint.value });
    }
    assertUploadGate(verificationPassed, manifestValidated, checksumValidated, fingerprintValidated) {
        if (!(verificationPassed && manifestValidated && checksumValidated && fingerprintValidated)) {
            throw new DomainInvariantError("Package upload gate has not been satisfied", {
                verificationPassed,
                manifestValidated,
                checksumValidated,
                fingerprintValidated,
            });
        }
    }
}
export class ProviderSelectionPolicy {
    select(candidates) {
        const eligible = candidates
            .filter((candidate) => candidate.capabilityMatch && candidate.featureFlagsEnabled && candidate.healthy)
            .slice()
            .sort((left, right) => right.priority - left.priority || left.providerReference.localeCompare(right.providerReference));
        if (eligible.length === 0) {
            throw new DomainInvariantError("No eligible provider candidates available", { candidates });
        }
        return eligible[0].providerReference;
    }
}
export class RoyaltyPolicy {
    assertImportable(status, receipt, territories) {
        if (status.value !== "LIVE" && status.value !== "ACCEPTED") {
            throw new DomainInvariantError("Royalty import requires an accepted or live provider submission", { status: status.value });
        }
        ensure(Boolean(receipt.value), "Royalty import requires a provider receipt");
        ensure(!territories.isEmpty(), "Royalty import requires at least one territory");
    }
    calculateRevenue(units, ratePerUnit) {
        normalizePositiveInteger(units, "units");
        if (!Number.isFinite(ratePerUnit) || ratePerUnit < 0) {
            throw new DomainInvariantError("ratePerUnit must be non-negative", { ratePerUnit });
        }
        return Number((units * ratePerUnit).toFixed(6));
    }
}

function error(path, code, message, value) {
    return { path, code, message, severity: "error", value };
}
function warning(path, code, message, value) {
    return { path, code, message, severity: "warning", value };
}
function isNonEmptyText(value) {
    return typeof value === "string" && value.trim().length > 0;
}
function toArray(value) {
    return value ?? [];
}
export class DdexValidator {
    validateErn(message) {
        const issues = [];
        this.validateHeader(message, issues);
        this.validateResources(message.resourceList.resources, issues);
        this.validateParties(message.partyList.parties, issues);
        this.validateDeals(message.dealList.deals, issues);
        this.validateReleases(message, issues);
        return this.toResult(issues, {
            messageType: message.messageHeader.messageType,
            releaseCount: message.releaseList.releases.length,
            resourceCount: message.resourceList.resources.length,
            partyCount: message.partyList.parties.length,
            dealCount: message.dealList.deals.length,
        });
    }
    validateMead(message) {
        const issues = [];
        if (!isNonEmptyText(message.releaseId))
            issues.push(error("releaseId", "missing_release_id", "MEAD update requires a releaseId", message.releaseId));
        if (message.updates.title != null && !isNonEmptyText(message.updates.title))
            issues.push(error("updates.title", "invalid_title", "Title update must be non-empty", message.updates.title));
        if (message.updates.territories && message.updates.territories.length === 0)
            issues.push(error("updates.territories", "missing_territories", "Territory updates must not be empty", message.updates.territories));
        if (message.updates.rights?.territories && message.updates.rights.territories.length === 0) {
            issues.push(error("updates.rights.territories", "missing_territories", "Rights territory updates must not be empty", message.updates.rights.territories));
        }
        if (!message.updates.title && !message.updates.artwork && !message.updates.resources?.length && !message.updates.rights && !message.updates.territories && !message.updates.relationships?.length) {
            issues.push(error("updates", "empty_update", "MEAD update must contain at least one change", message.updates));
        }
        return this.toResult(issues, { messageType: message.messageHeader.messageType, releaseId: message.releaseId });
    }
    validateRin(message) {
        const issues = [];
        if (!isNonEmptyText(message.sessionId))
            issues.push(error("sessionId", "missing_session_id", "RIN requires a sessionId", message.sessionId));
        if (!isNonEmptyText(message.releaseId))
            issues.push(error("releaseId", "missing_release_id", "RIN requires a releaseId", message.releaseId));
        if (!isNonEmptyText(message.recordingTitle))
            issues.push(error("recordingTitle", "missing_recording_title", "RIN requires a recording title", message.recordingTitle));
        if (!isNonEmptyText(message.isrc ?? undefined))
            issues.push(warning("isrc", "missing_isrc", "RIN is stronger when ISRC is present", message.isrc));
        if (message.studios.length === 0)
            issues.push(warning("studios", "missing_studios", "RIN is stronger when studio information is provided", message.studios));
        if (message.engineers.length === 0 && message.musicians.length === 0) {
            issues.push(warning("contributors", "missing_contributors", "RIN is stronger when contributors are provided", {
                engineers: message.engineers,
                musicians: message.musicians,
            }));
        }
        return this.toResult(issues, { messageType: message.messageHeader.messageType, sessionId: message.sessionId });
    }
    validateExportArtifact(artifact) {
        return this.toResult(artifact.xml.trim().length > 0 ? [] : [error("xml", "empty_xml", "XML artifact must not be empty", artifact.xml)], { messageType: artifact.messageType, checksum: artifact.checksum, format: artifact.format });
    }
    validateHeader(message, issues) {
        const header = message.messageHeader;
        if (!isNonEmptyText(header.messageId))
            issues.push(error("messageHeader.messageId", "missing_message_id", "Message header requires a messageId", header.messageId));
        if (!isNonEmptyText(header.sender))
            issues.push(error("messageHeader.sender", "missing_sender", "Message header requires a sender", header.sender));
        if (!isNonEmptyText(header.recipient))
            issues.push(error("messageHeader.recipient", "missing_recipient", "Message header requires a recipient", header.recipient));
        if (!isNonEmptyText(header.creationDateTime))
            issues.push(error("messageHeader.creationDateTime", "missing_creation_time", "Message header requires a creation date/time", header.creationDateTime));
    }
    validateResources(resources, issues) {
        if (resources.length === 0)
            issues.push(error("resourceList.resources", "missing_resource", "ERN requires at least one resource", resources));
    }
    validateReleases(message, issues) {
        if (message.releaseList.releases.length === 0)
            issues.push(error("releaseList.releases", "missing_release", "ERN requires at least one release", message.releaseList.releases));
        const resourceIds = new Set();
        const partyIds = new Set();
        const dealIds = new Set();
        for (const party of message.partyList.parties) {
            if (partyIds.has(party.partyId))
                issues.push(error("partyList.parties", "duplicate_party", "Duplicate party identifier detected", party.partyId));
            partyIds.add(party.partyId);
        }
        for (const resource of message.resourceList.resources) {
            if (resourceIds.has(resource.resourceId))
                issues.push(error("resourceList.resources", "duplicate_resource", "Duplicate resource identifier detected", resource.resourceId));
            resourceIds.add(resource.resourceId);
        }
        for (const deal of message.dealList.deals) {
            if (dealIds.has(deal.dealId))
                issues.push(error("dealList.deals", "duplicate_deal", "Duplicate deal identifier detected", deal.dealId));
            dealIds.add(deal.dealId);
        }
        for (const release of message.releaseList.releases) {
            if (!isNonEmptyText(release.releaseId))
                issues.push(error("release.releaseId", "missing_release_id", "Release requires a releaseId", release.releaseId));
            if (!isNonEmptyText(release.title))
                issues.push(error("release.title", "missing_release_title", "Release requires a title", release.title));
            if (!isNonEmptyText(release.label ?? undefined))
                issues.push(warning("release.label", "missing_label", "Release is stronger when label information is present", release.label));
            if (release.identifiers.length === 0)
                issues.push(error("release.identifiers", "missing_identifiers", "Release must include identifiers", release.identifiers));
            if (release.resourceRefs.length === 0)
                issues.push(error("release.resourceRefs", "missing_resources", "Release must reference at least one resource", release.resourceRefs));
            if (release.partyRefs.length === 0)
                issues.push(error("release.partyRefs", "missing_parties", "Release must reference at least one party", release.partyRefs));
            if (release.dealRefs.length === 0)
                issues.push(error("release.dealRefs", "missing_deals", "Release must reference at least one deal", release.dealRefs));
            if (release.territories.length === 0)
                issues.push(error("release.territories", "missing_territories", "Release must define territories", release.territories));
            if (!isNonEmptyText(release.language ?? undefined))
                issues.push(warning("release.language", "missing_language", "Release is stronger when language is present", release.language));
            if (!isNonEmptyText(release.genre ?? undefined))
                issues.push(warning("release.genre", "missing_genre", "Release is stronger when genre is present", release.genre));
            if (release.technicalDetails.multiDisc && !release.versioned && !isNonEmptyText(release.versionTitle ?? undefined)) {
                issues.push(warning("release.versionTitle", "missing_version", "Versioned releases should include a version title", release.versionTitle));
            }
        }
        for (const resource of message.resourceList.resources) {
            if (resource.resourceType === "SoundRecording") {
                this.validateSoundRecording(resource, issues);
            }
            else if (resource.resourceType === "Image") {
                this.validateImage(resource, issues);
            }
            else if (resource.resourceType === "Video") {
                this.validateVideo(resource, issues);
            }
            else {
                this.validateText(resource, issues);
            }
        }
    }
    validateSoundRecording(resource, issues) {
        if (resource.resourceType !== "SoundRecording")
            return;
        if (!isNonEmptyText(resource.isrc))
            issues.push(error(`resource.${resource.resourceId}.isrc`, "missing_isrc", "Sound recording requires an ISRC", resource.isrc));
        if (!isNonEmptyText(resource.title))
            issues.push(error(`resource.${resource.resourceId}.title`, "missing_title", "Sound recording requires a title", resource.title));
        if (resource.contributors.length === 0)
            issues.push(error(`resource.${resource.resourceId}.contributors`, "missing_contributors", "Sound recording requires contributors", resource.contributors));
        if (resource.sequenceNumber <= 0)
            issues.push(error(`resource.${resource.resourceId}.sequenceNumber`, "invalid_sequence", "Track sequence must be positive", resource.sequenceNumber));
        if (resource.discNumber <= 0)
            issues.push(error(`resource.${resource.resourceId}.discNumber`, "invalid_disc", "Disc number must be positive", resource.discNumber));
        if (!isNonEmptyText(resource.audioUrl ?? undefined))
            issues.push(warning(`resource.${resource.resourceId}.audioUrl`, "missing_audio", "Sound recording is stronger when audio is present", resource.audioUrl));
    }
    validateImage(resource, issues) {
        if (resource.resourceType !== "Image")
            return;
        if (!isNonEmptyText(resource.uri))
            issues.push(error(`resource.${resource.resourceId}.uri`, "missing_uri", "Image requires a URI", resource.uri));
        if (!isNonEmptyText(resource.title))
            issues.push(error(`resource.${resource.resourceId}.title`, "missing_title", "Image requires a title", resource.title));
    }
    validateVideo(resource, issues) {
        if (resource.resourceType !== "Video")
            return;
        if (!isNonEmptyText(resource.uri))
            issues.push(error(`resource.${resource.resourceId}.uri`, "missing_uri", "Video requires a URI", resource.uri));
        if (!isNonEmptyText(resource.title))
            issues.push(error(`resource.${resource.resourceId}.title`, "missing_title", "Video requires a title", resource.title));
    }
    validateText(resource, issues) {
        if (resource.resourceType !== "Text")
            return;
        if (!isNonEmptyText(resource.text))
            issues.push(error(`resource.${resource.resourceId}.text`, "missing_text", "Text resource requires text content", resource.text));
    }
    validateParties(parties, issues) {
        if (parties.length === 0)
            issues.push(error("partyList.parties", "missing_party", "ERN requires at least one party", parties));
        for (const party of parties) {
            if (!isNonEmptyText(party.partyId))
                issues.push(error("party.partyId", "missing_party_id", "Party requires an identifier", party.partyId));
            if (!isNonEmptyText(party.name))
                issues.push(error("party.name", "missing_party_name", "Party requires a name", party.name));
        }
    }
    validateDeals(deals, issues) {
        if (deals.length === 0)
            issues.push(error("dealList.deals", "missing_deal", "ERN requires at least one deal", deals));
        for (const deal of deals) {
            if (!isNonEmptyText(deal.dealId))
                issues.push(error("deal.dealId", "missing_deal_id", "Deal requires an identifier", deal.dealId));
            if (toArray(deal.territoryCodes).length === 0)
                issues.push(error("deal.territoryCodes", "missing_territories", "Deal requires at least one territory", deal.territoryCodes));
            if (toArray(deal.priceInformation).length === 0)
                issues.push(warning("deal.priceInformation", "missing_price_information", "Deal is stronger when price information is present", deal.priceInformation));
        }
    }
    toResult(errors, metadata) {
        const normalizedErrors = Object.freeze([...errors.filter((entry) => entry.severity === "error")]);
        const normalizedWarnings = Object.freeze([...errors.filter((entry) => entry.severity === "warning")]);
        return Object.freeze({
            valid: normalizedErrors.length === 0,
            errors: normalizedErrors,
            warnings: normalizedWarnings,
            metadata: Object.freeze({ ...metadata }),
        });
    }
}

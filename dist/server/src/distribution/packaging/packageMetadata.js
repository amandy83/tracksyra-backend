import { deepFreeze, toJsonText } from "./packageUtils.js";
export class PackageMetadata {
    release;
    constructor(release) {
        this.release = release;
    }
    documents() {
        return deepFreeze({
            release: this.releaseDocument(),
            tracks: this.trackDocuments(),
            contributors: this.contributorDocuments(),
            publishing: this.publishingDocument(),
            rights: this.rightsDocument(),
            territories: this.territoryDocuments(),
            pricing: this.pricingDocument(),
        });
    }
    releaseJson() {
        return toJsonText(this.releaseDocument());
    }
    tracksJson() {
        return toJsonText(this.trackDocuments());
    }
    contributorsJson() {
        return toJsonText(this.contributorDocuments());
    }
    publishingJson() {
        return toJsonText(this.publishingDocument());
    }
    rightsJson() {
        return toJsonText(this.rightsDocument());
    }
    territoriesJson() {
        return toJsonText(this.territoryDocuments());
    }
    pricingJson() {
        return toJsonText(this.pricingDocument());
    }
    releaseDocument() {
        const genre = this.release.genre;
        const language = this.release.language;
        return {
            id: this.release.id,
            version: this.release.version,
            kind: this.release.kind,
            title: this.release.title,
            releaseType: this.release.releaseType,
            versionTitle: this.release.versionTitle,
            primaryArtist: this.release.primaryArtist,
            featuringArtists: this.release.featuringArtists,
            variousArtists: this.release.variousArtists,
            label: this.release.label,
            releaseDate: this.release.releaseDate,
            originalReleaseDate: this.release.originalReleaseDate,
            recordingYear: this.release.recordingYear,
            genre: serializeGenre(genre),
            language: serializeLanguage(language),
            advisory: this.release.advisory,
            explicit: this.release.explicit,
            clean: this.release.clean,
            identifiers: this.release.identifiers,
            rights: serializeRights(this.release.rights),
            artwork: this.release.artwork,
            audio: this.release.audio,
            publishing: this.release.publishing,
            contributors: this.release.contributors,
            territories: this.release.territories,
            pricing: serializePricing(this.release.pricing),
            tracks: this.release.tracks.map((track) => track.id),
            multiDisc: this.release.multiDisc,
            podcast: this.release.podcast,
            audiobook: this.release.audiobook,
            compilation: this.release.compilation,
            instrumental: this.release.instrumental,
        };
    }
    trackDocuments() {
        return this.release.tracks.map((track) => ({
            id: track.id,
            title: track.title,
            version: track.version,
            discNumber: track.discNumber,
            trackNumber: track.trackNumber,
            primaryArtist: track.primaryArtist,
            featuredArtists: track.featuredArtists,
            remixer: track.remixer,
            contributorNames: track.contributorNames,
            contributors: track.contributors,
            publishing: track.publishing,
            audio: track.audio,
            rights: track.rights,
            artwork: track.artwork,
            identifiers: track.identifiers,
            territories: track.territories,
            pricing: serializePricing(track.pricing),
            language: serializeLanguage(track.language),
            genre: serializeGenre(track.genre),
            advisory: track.advisory,
            explicit: track.explicit,
            clean: track.clean,
            pLine: track.pLine,
            cLine: track.cLine,
            lyrics: track.lyrics,
            recordingYear: track.recordingYear,
        }));
    }
    contributorDocuments() {
        return dedupeContributors([...this.release.contributors, ...this.release.tracks.flatMap((track) => track.contributors)]).map((contributor) => ({
            name: contributor.name,
            roles: contributor.roles,
            splitPercentage: contributor.splitPercentage,
            ipi: contributor.ipi,
            isPrimary: contributor.isPrimary,
            metadata: contributor.metadata,
        }));
    }
    publishingDocument() {
        return {
            publisher: this.release.publishing.publisher,
            writers: this.release.publishing.writers,
            splits: this.release.publishing.splits,
        };
    }
    rightsDocument() {
        return {
            release: serializeRights(this.release.rights),
            tracks: this.release.tracks.map((track) => serializeRights(track.rights)),
        };
    }
    territoryDocuments() {
        return dedupeTerritories([...this.release.territories, ...this.release.tracks.flatMap((track) => track.territories)]).map((territory) => ({
            code: territory.code,
            name: territory.name,
            isrc: territory.isrc,
            upc: territory.upc,
            release: territory.release,
            track: territory.track,
        }));
    }
    pricingDocument() {
        return {
            release: serializePricing(this.release.pricing),
            tracks: this.release.tracks.map((track) => serializePricing(track.pricing)),
        };
    }
}
function serializeGenre(value) {
    return value ? { primary: value.primary, subgenre: value.subgenre, secondary: value.secondary, secondarySubgenre: value.secondarySubgenre } : null;
}
function serializeLanguage(value) {
    return value ? { code: value.code, name: value.name } : null;
}
function serializePricing(value) {
    return value ? { currency: value.currency, amount: value.amount, tier: value.tier, territories: value.territories } : null;
}
function serializeRights(value) {
    return value ? {
        copyrightOwner: value.copyrightOwner,
        copyrightYear: value.copyrightYear,
        copyrightNotice: value.copyrightNotice,
        pLine: value.pLine,
        cLine: value.cLine,
        rightsOwned: value.rightsOwned,
        aiContentDeclared: value.aiContentDeclared,
        territories: value.territories,
    } : null;
}
function dedupeContributors(values) {
    const seen = new Set();
    const result = [];
    for (const contributor of values) {
        const key = contributor.name.toLowerCase();
        if (seen.has(key))
            continue;
        seen.add(key);
        result.push(contributor);
    }
    return result;
}
function dedupeTerritories(values) {
    const seen = new Set();
    const result = [];
    for (const territory of values) {
        const key = territory.code.toUpperCase();
        if (seen.has(key))
            continue;
        seen.add(key);
        result.push(territory);
    }
    return result;
}

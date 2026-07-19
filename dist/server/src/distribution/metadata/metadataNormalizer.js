export class MetadataNormalizer {
    trim(value) {
        const normalized = typeof value === "string" ? value.trim() : "";
        return normalized ? normalized : null;
    }
    text(value) {
        return this.trim(typeof value === "string" ? value : value == null ? null : String(value));
    }
    textArray(values) {
        return Object.freeze([...(values ?? [])]
            .map((value) => this.text(value))
            .filter((value) => Boolean(value)));
    }
    language(value, fallback = "und", name) {
        const code = this.text(value)?.toLowerCase() ?? fallback;
        return Object.freeze({
            code,
            name: this.text(name),
            metadata: Object.freeze({}),
        });
    }
    genre(primary, subgenre, secondary, secondarySubgenre) {
        return Object.freeze({
            primary: this.text(primary),
            subgenre: this.text(subgenre),
            secondary: this.text(secondary),
            secondarySubgenre: this.text(secondarySubgenre),
            metadata: Object.freeze({}),
        });
    }
    advisory(value, explicit, clean) {
        const normalized = this.text(value)?.toLowerCase();
        if (normalized === "explicit")
            return "explicit";
        if (normalized === "clean")
            return "clean";
        if (normalized === "none")
            return "none";
        if (explicit)
            return "explicit";
        if (clean)
            return "clean";
        return "none";
    }
    date(value, kind) {
        const text = this.text(value);
        if (!text)
            return null;
        const parsed = parseDate(text);
        return Object.freeze({
            kind,
            value: parsed.value,
            year: parsed.year,
            month: parsed.month,
            day: parsed.day,
            isExact: parsed.isExact,
            metadata: Object.freeze({}),
        });
    }
    identifier(type, value, scope = "release", issuer) {
        const normalizedValue = this.text(value);
        if (!normalizedValue)
            return null;
        return Object.freeze({
            type: this.text(type) ?? "unknown",
            value: normalizedValue,
            scope,
            issuer: this.text(issuer),
            metadata: Object.freeze({}),
        });
    }
    identifiers(entries) {
        const seen = new Set();
        const result = [];
        for (const entry of entries ?? []) {
            const key = [entry.scope, entry.type.toLowerCase(), entry.value.toLowerCase()].join("|");
            if (seen.has(key))
                continue;
            seen.add(key);
            result.push(Object.freeze({
                ...entry,
                type: this.trim(entry.type) ?? "unknown",
                value: this.trim(entry.value) ?? entry.value,
                issuer: this.trim(entry.issuer),
            }));
        }
        return Object.freeze(result);
    }
    territory(value, name, flags) {
        const code = this.text(value);
        if (!code)
            return null;
        return Object.freeze({
            code: code.toUpperCase(),
            name: this.text(name),
            isrc: null,
            upc: null,
            release: flags?.release ?? true,
            track: flags?.track ?? true,
            metadata: Object.freeze({}),
        });
    }
    territories(values) {
        const seen = new Set();
        const result = [];
        for (const item of values ?? []) {
            const key = item.code.toUpperCase();
            if (seen.has(key))
                continue;
            seen.add(key);
            result.push(Object.freeze({
                ...item,
                code: key,
                name: this.text(item.name),
                isrc: this.text(item.isrc),
                upc: this.text(item.upc),
            }));
        }
        return Object.freeze(result);
    }
    pricing(value, tier, territories) {
        if (value == null && tier == null && !(territories?.length))
            return null;
        const amount = typeof value === "number" && Number.isFinite(value) ? value : null;
        return Object.freeze({
            currency: null,
            amount,
            tier: this.text(tier),
            territories: this.territories(territories ?? []),
            metadata: Object.freeze({}),
        });
    }
    contributor(name, roles, splitPercentage, metadata = {}) {
        const normalizedName = this.text(name);
        if (!normalizedName)
            return null;
        const normalizedRoles = Array.isArray(roles) ? roles : [roles];
        return Object.freeze({
            name: normalizedName,
            roles: Object.freeze(normalizedRoles.map((role) => this.text(role) ?? String(role))),
            splitPercentage: typeof splitPercentage === "number" && Number.isFinite(splitPercentage) ? splitPercentage : null,
            ipi: null,
            isPrimary: false,
            metadata: Object.freeze({ ...metadata }),
        });
    }
    contributors(values) {
        const seen = new Set();
        const result = [];
        for (const contributor of values ?? []) {
            const name = this.trim(contributor.name);
            if (!name)
                continue;
            const key = name.toLowerCase();
            if (seen.has(key))
                continue;
            seen.add(key);
            result.push(Object.freeze({
                ...contributor,
                name,
                roles: Object.freeze([...new Set(contributor.roles.map((role) => this.text(role) ?? String(role)).filter(Boolean))]),
                ipi: this.trim(contributor.ipi),
                splitPercentage: typeof contributor.splitPercentage === "number" && Number.isFinite(contributor.splitPercentage) ? contributor.splitPercentage : null,
                metadata: Object.freeze({ ...(contributor.metadata ?? {}) }),
            }));
        }
        return Object.freeze(result);
    }
    audio(value) {
        if (!value)
            return null;
        const hasMeaningful = Boolean(value.url || value.checksum || value.mimeType || value.format);
        if (!hasMeaningful)
            return null;
        return Object.freeze({
            url: this.text(value.url),
            checksum: this.text(value.checksum),
            mimeType: this.text(value.mimeType),
            format: this.text(value.format),
            durationSeconds: typeof value.durationSeconds === "number" && Number.isFinite(value.durationSeconds) ? value.durationSeconds : null,
            sampleRateHz: typeof value.sampleRateHz === "number" && Number.isFinite(value.sampleRateHz) ? value.sampleRateHz : null,
            channels: typeof value.channels === "number" && Number.isFinite(value.channels) ? value.channels : null,
            bitrateKbps: typeof value.bitrateKbps === "number" && Number.isFinite(value.bitrateKbps) ? value.bitrateKbps : null,
            explicit: Boolean(value.explicit),
            metadata: Object.freeze({ ...(value.metadata ?? {}) }),
        });
    }
    artwork(value) {
        if (!value)
            return null;
        const hasMeaningful = Boolean(value.url || value.checksum || value.mimeType);
        if (!hasMeaningful)
            return null;
        return Object.freeze({
            url: this.text(value.url),
            checksum: this.text(value.checksum),
            mimeType: this.text(value.mimeType),
            width: typeof value.width === "number" && Number.isFinite(value.width) ? value.width : null,
            height: typeof value.height === "number" && Number.isFinite(value.height) ? value.height : null,
            title: this.text(value.title),
            altText: this.text(value.altText),
            metadata: Object.freeze({ ...(value.metadata ?? {}) }),
        });
    }
    rights(value) {
        if (!value)
            return null;
        const hasMeaningful = Boolean(value.copyrightOwner || value.copyrightNotice || value.pLine || value.cLine);
        if (!hasMeaningful && value.rightsOwned == null && value.aiContentDeclared == null)
            return null;
        return Object.freeze({
            copyrightOwner: this.text(value.copyrightOwner),
            copyrightYear: typeof value.copyrightYear === "number" && Number.isFinite(value.copyrightYear) ? value.copyrightYear : null,
            copyrightNotice: this.text(value.copyrightNotice),
            pLine: this.text(value.pLine),
            cLine: this.text(value.cLine),
            rightsOwned: value.rightsOwned ?? null,
            aiContentDeclared: value.aiContentDeclared ?? null,
            territories: this.territories(value.territories ?? []),
            metadata: Object.freeze({ ...(value.metadata ?? {}) }),
        });
    }
}
function parseDate(input) {
    const value = input.trim();
    const exact = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const yearOnly = /^\d{4}$/.test(value);
    const year = yearOnly || exact ? Number.parseInt(value.slice(0, 4), 10) : null;
    const month = exact ? Number.parseInt(value.slice(5, 7), 10) : null;
    const day = exact ? Number.parseInt(value.slice(8, 10), 10) : null;
    return {
        value,
        year: Number.isFinite(year ?? NaN) ? year : null,
        month: Number.isFinite(month ?? NaN) ? month : null,
        day: Number.isFinite(day ?? NaN) ? day : null,
        isExact: exact,
    };
}

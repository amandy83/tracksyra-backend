export class SupabaseMediaStorageAdapter {
    client;
    provider = "supabase";
    constructor(client) {
        this.client = client;
    }
    async getObject(bucket, key) {
        const { data, error } = await this.client.storage.from(bucket).download(key);
        if (error)
            throw error;
        return Buffer.from(await data.arrayBuffer());
    }
    async putObject(input) {
        const bytes = toArrayBuffer(input.body);
        const { data, error } = await this.client.storage.from(input.bucket).upload(input.key, bytes, {
            upsert: true,
            contentType: input.contentType,
            cacheControl: input.cacheControl || "private, max-age=31536000, immutable",
        });
        if (error)
            throw error;
        const stored = {
            provider: this.provider,
            bucket: input.bucket,
            key: data.path,
            contentType: input.contentType,
            sizeBytes: Buffer.byteLength(Buffer.from(bytes)),
            etag: null,
        };
        return stored;
    }
    async createSignedUrl(input) {
        const { data, error } = await this.client.storage.from(input.bucket).createSignedUrl(input.key, input.expiresInSeconds, {
            download: input.disposition === "attachment",
        });
        if (error)
            throw error;
        return data.signedUrl;
    }
    getCdnHeaders(variant) {
        const immutable = variant === "master_archive" || variant.startsWith("artwork_") || variant.startsWith("mp3_");
        return {
            "Cache-Control": immutable ? "private, max-age=31536000, immutable" : "private, max-age=3600",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; media-src 'self'; img-src 'self';",
        };
    }
}
export class S3CompatibleMediaStorageAdapter {
    provider;
    constructor(provider) {
        this.provider = provider;
    }
    async getObject() {
        throw new Error(`${this.provider.toUpperCase()} storage is configured as an interface placeholder. Provide a concrete client adapter before use.`);
    }
    async putObject() {
        throw new Error(`${this.provider.toUpperCase()} storage is configured as an interface placeholder. Provide a concrete client adapter before use.`);
    }
    async createSignedUrl() {
        throw new Error(`${this.provider.toUpperCase()} signing is configured as an interface placeholder. Provide a concrete client adapter before use.`);
    }
    getCdnHeaders() {
        return {
            "Cache-Control": "private, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
        };
    }
}
function toArrayBuffer(body) {
    if (body instanceof ArrayBuffer)
        return body;
    return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
}

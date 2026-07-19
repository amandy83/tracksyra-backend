export class NoopPackageEncryption {
    kind = "none";
    createEncryptStream() {
        return null;
    }
    createDecryptStream() {
        return null;
    }
}
export class Aes256GcmPackageEncryption {
    key;
    kind = "aes-256-gcm";
    constructor(key) {
        this.key = key;
        if (key.length !== 32)
            throw new Error("AES-256-GCM requires a 32-byte key");
    }
    createEncryptStream() {
        throw new Error("Streaming AES-256-GCM package encryption requires an external IV/signature envelope");
    }
    createDecryptStream() {
        throw new Error("Streaming AES-256-GCM package decryption requires an external IV/signature envelope");
    }
}

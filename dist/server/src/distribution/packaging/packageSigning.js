import { createSign } from "node:crypto";
import { stableStringify } from "./packageUtils.js";
export class NodePackageSigning {
    privateKey;
    algorithm;
    keyId;
    constructor(privateKey, algorithm = "RSA-SHA256", keyId = null) {
        this.privateKey = privateKey;
        this.algorithm = algorithm;
        this.keyId = keyId;
    }
    sign(manifest) {
        const signer = createSign(this.algorithm);
        signer.update(stableStringify(manifest));
        signer.end();
        return {
            algorithm: this.algorithm,
            value: signer.sign(this.privateKey, "base64"),
            keyId: this.keyId,
        };
    }
}

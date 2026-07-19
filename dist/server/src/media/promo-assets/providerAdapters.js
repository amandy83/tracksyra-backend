export class InternalUploadPromoAssetAdapter {
    providerName = "internal_upload";
    async submit(input) {
        return {
            externalAssetId: `internal:${input.assetId}`,
            syncStatus: "queued",
        };
    }
}
export function createPromoAssetProviderAdapter(adapter) {
    return adapter;
}

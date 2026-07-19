export class SandboxPayoutProviderAdapter {
    async createPayout(input) {
        const providerReference = `${this.provider}_${input.payoutRequestId}`;
        return {
            provider: this.provider,
            providerReference,
            status: "queued",
            receiptUrl: null,
            rawResponse: {
                mode: "sandbox",
                providerReference,
                message: "Payout adapter prepared; live settlement is controlled by provider credentials and approval.",
            },
        };
    }
}

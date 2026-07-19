// Deterministic sandbox client stub for Wise.
export class WiseSandboxClient {
    async initiatePayment(_payload) {
        return { provider_payment_id: `wise_sandbox_${Date.now()}` };
    }
    async verifyPayment(_payload) {
        return { verified: true };
    }
    async refundPayment(_payload) {
        return { refunded: true };
    }
}

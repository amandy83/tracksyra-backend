// Deterministic live client stub for Wise.
export class WiseLiveClient {
    async initiatePayment(_payload) {
        return { provider_payment_id: `wise_live_${Date.now()}` };
    }
    async verifyPayment(_payload) {
        return { verified: true };
    }
    async refundPayment(_payload) {
        return { refunded: true };
    }
}

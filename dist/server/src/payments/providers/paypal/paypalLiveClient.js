// Deterministic live client stub for PayPal.
export class PayPalLiveClient {
    async initiatePayment(_payload) {
        return { provider_payment_id: `paypal_live_${Date.now()}` };
    }
    async verifyPayment(_payload) {
        return { verified: true };
    }
    async refundPayment(_payload) {
        return { refunded: true };
    }
}

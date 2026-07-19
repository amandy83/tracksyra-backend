// Deterministic sandbox client stub for PayPal.
export class PayPalSandboxClient {
    async initiatePayment(_payload) {
        return { provider_payment_id: `paypal_sandbox_${Date.now()}` };
    }
    async verifyPayment(_payload) {
        return { verified: true };
    }
    async refundPayment(_payload) {
        return { refunded: true };
    }
}

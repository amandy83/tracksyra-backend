// Deterministic sandbox client stub for Stripe.
export class StripeSandboxClient {
    async initiatePayment(_payload) {
        return { provider_payment_id: `stripe_sandbox_${Date.now()}` };
    }
    async verifyPayment(_payload) {
        return { verified: true };
    }
    async refundPayment(_payload) {
        return { refunded: true };
    }
}

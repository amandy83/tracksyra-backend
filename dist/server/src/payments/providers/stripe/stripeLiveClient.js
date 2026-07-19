// Deterministic live client stub for Stripe.
// Governance: no real provider calls in this scaffolding.
export class StripeLiveClient {
    async initiatePayment(_payload) {
        return { provider_payment_id: `stripe_live_${Date.now()}` };
    }
    async verifyPayment(_payload) {
        return { verified: true };
    }
    async refundPayment(_payload) {
        return { refunded: true };
    }
}

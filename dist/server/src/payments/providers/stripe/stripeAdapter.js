// Stripe adapter stub. Must expose deterministic methods only.
export function makeStripeAdapter(_opts) {
    return {
        async initiatePayment(input) {
            void input;
            return { ok: true, provider_payment_id: `stripe_${input.sandbox_mode ? "sandbox" : "live"}_fake_${input.correlation_id}` };
        },
        async verifyPayment() {
            return { ok: true };
        },
        async refundPayment() {
            return { ok: true };
        },
        async handleWebhook() {
            return { ok: true };
        },
    };
}

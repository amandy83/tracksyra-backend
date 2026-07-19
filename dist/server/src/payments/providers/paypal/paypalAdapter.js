export function makePayPalAdapter(_opts) {
    return {
        async initiatePayment(input) {
            return { ok: true, provider_payment_id: `paypal_${input.sandbox_mode ? "sandbox" : "live"}_fake_${input.correlation_id}` };
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

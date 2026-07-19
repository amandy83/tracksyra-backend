import { PaymentState } from "./paymentEnums.js";
// Deterministic placeholder model factory.
export function makePaymentRecord(input) {
    return {
        payment_id: input.payment_id,
        payment_request_event_id: input.payment_request_event_id,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        amount_inr: input.amount_inr,
        currency: input.currency,
        state: PaymentState.INITIATED,
        sandbox_mode: input.sandbox_mode,
        provider: null,
        provider_payment_id: null,
        correlation_id: input.correlation_id,
        created_at_iso: new Date().toISOString(),
        updated_at_iso: null,
    };
}

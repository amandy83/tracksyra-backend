import { PaymentState } from "../models/paymentEnums.js";
import { validatePaymentTransition } from "./paymentStateMachine.js";
export class PaymentEngine {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async initiate(input) {
        // Deterministic placeholder: validation/orchestration added in later phases.
        const record = {
            payment_id: input.payment_request_event_id, // deterministic placeholder
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
        if (!validatePaymentTransition(null, PaymentState.INITIATED)) {
            return { ok: false, reason: "Invalid initial payment state" };
        }
        await this.deps.persistPayment({
            payment_request_event_id: input.payment_request_event_id,
            record,
        });
        return { ok: true, payment: record };
    }
}

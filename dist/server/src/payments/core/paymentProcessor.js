export class PaymentProcessor {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async process(_payment) {
        // Phase D scaffold: no real provider calls.
        return { ok: true };
    }
}

export class PaymentOrchestrator {
    paymentEngine;
    constructor(paymentEngine) {
        this.paymentEngine = paymentEngine;
    }
    async handleInitiate(input) {
        const res = await this.paymentEngine.initiate(input);
        if (!res.ok)
            throw new Error(res.reason);
        return res.payment;
    }
}

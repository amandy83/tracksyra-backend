import { SandboxPayoutProviderAdapter } from "./payoutProviderAdapter.js";
export class RazorpayPayoutAdapter extends SandboxPayoutProviderAdapter {
    provider = "razorpay";
}
export class StripePayoutAdapter extends SandboxPayoutProviderAdapter {
    provider = "stripe";
}
export class BankTransferPayoutAdapter extends SandboxPayoutProviderAdapter {
    provider = "bank_transfer";
}
export function createPayoutProviderAdapter(adapter) {
    return adapter;
}

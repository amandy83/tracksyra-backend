import { SandboxPayoutProviderAdapter } from "./payoutProviderAdapter";

export class RazorpayPayoutAdapter extends SandboxPayoutProviderAdapter {
  readonly provider = "razorpay" as const;
}

export class StripePayoutAdapter extends SandboxPayoutProviderAdapter {
  readonly provider = "stripe" as const;
}

export class BankTransferPayoutAdapter extends SandboxPayoutProviderAdapter {
  readonly provider = "bank_transfer" as const;
}

export function createPayoutProviderAdapter(adapter: RazorpayPayoutAdapter | StripePayoutAdapter | BankTransferPayoutAdapter) {
  return adapter;
}

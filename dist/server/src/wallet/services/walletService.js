// Phase C: Read-only wallet service contract used by payout eligibility.
// Governance: MUST NOT perform any ledger writes, payouts, or financial settlement.
// Minimal deterministic implementation placeholder.
// NOTE: This is intentionally read-only and will be wired to real persistence elsewhere.
// For compile-stabilization + smoke-test typing only.
export function createWalletService() {
    async function getWalletBalance(input) {
        return {
            wallet_id: null,
            available_balance: "0",
            pending_balance: "0",
            locked_balance: "0",
            currency: input.currency,
            updated_at: new Date().toISOString(),
        };
    }
    async function getAvailableBalance(input) {
        void input;
        return {
            available_balance: "0",
            pending_balance: "0",
            locked_balance: "0",
            currency: input.currency,
            updated_at: new Date().toISOString(),
            wallet_id: null,
        };
    }
    async function getPendingBalance(input) {
        void input;
        return {
            available_balance: "0",
            pending_balance: "0",
            locked_balance: "0",
            currency: input.currency,
            updated_at: new Date().toISOString(),
            wallet_id: null,
        };
    }
    return {
        getWalletBalance,
        getAvailableBalance,
        getPendingBalance,
    };
}

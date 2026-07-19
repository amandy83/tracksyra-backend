// Phase C: Read-only wallet service contract used by payout eligibility.
// Governance: MUST NOT perform any ledger writes, payouts, or financial settlement.

import type {
  EntityType,
  BalanceBreakdown,
  Wallet,
  WalletBalanceSnapshot,
} from "../models/walletTypes";

export type WalletService = {
  // Returns a snapshot suitable for deterministic eligibility checks.
  getWalletBalance: (input: {
    entity_type: EntityType;
    entity_id: string;
    currency: string;
    correlation_id: string;
  }) => Promise<WalletBalanceSnapshot>;

  getAvailableBalance: (input: {
    entity_type: EntityType;
    entity_id: string;
    currency: string;
    correlation_id: string;
  }) => Promise<BalanceBreakdown>;

  getPendingBalance: (input: {
    entity_type: EntityType;
    entity_id: string;
    currency: string;
    correlation_id: string;
  }) => Promise<BalanceBreakdown>;
};

// Minimal deterministic implementation placeholder.
// NOTE: This is intentionally read-only and will be wired to real persistence elsewhere.
// For compile-stabilization + smoke-test typing only.
export function createWalletService(): WalletService {
  async function getWalletBalance(input: {
    entity_type: EntityType;
    entity_id: string;
    currency: string;
    correlation_id: string;
  }): Promise<WalletBalanceSnapshot> {
    return {
      wallet_id: null,
      available_balance: "0",
      pending_balance: "0",
      locked_balance: "0",
      currency: input.currency,
      updated_at: new Date().toISOString(),
    };
  }

  async function getAvailableBalance(input: {
    entity_type: EntityType;
    entity_id: string;
    currency: string;
    correlation_id: string;
  }): Promise<BalanceBreakdown> {
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

  async function getPendingBalance(input: {
    entity_type: EntityType;
    entity_id: string;
    currency: string;
    correlation_id: string;
  }): Promise<BalanceBreakdown> {
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



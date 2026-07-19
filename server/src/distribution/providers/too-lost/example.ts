import { TOO_LOST_CALLBACK_URL } from "./oauth";
import { TooLostAuthClient } from "./client";
import { InMemoryTooLostTokenStorage, TooLostTokenManager } from "./tokenManager";

function createExampleTokenManager(): TooLostTokenManager {
  return new TooLostTokenManager({
    storage: new InMemoryTooLostTokenStorage(),
    pendingAuthTtlMs: 10 * 60 * 1000,
    refreshSkewMs: 60 * 1000,
  });
}

export async function runTooLostOAuthExample(): Promise<void> {
  const client = new TooLostAuthClient({ tokenManager: createExampleTokenManager() });

  const loginUrl = await client.loginUrl({
    prompt: "consent",
    access_type: "offline",
  });

  console.log("Too Lost OAuth login URL:");
  console.log(loginUrl);
  console.log("Too Lost callback URL:");
  console.log(TOO_LOST_CALLBACK_URL);
}

export async function handleTooLostOAuthCallbackExample(code: string, state: string): Promise<void> {
  const client = new TooLostAuthClient({ tokenManager: createExampleTokenManager() });
  const session = await client.handleCallback(code, state);

  console.log("Too Lost OAuth callback processed.");
  console.log("Token expires at:", session.expiresAt ?? "unknown");
}

export async function makeAuthenticatedTooLostRequestExample(): Promise<void> {
  const client = new TooLostAuthClient({ tokenManager: createExampleTokenManager() });
  const response = await client.request("https://api.toolost.com/v1/me");

  console.log("Too Lost API response status:", response.status);
}

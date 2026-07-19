import { createHash, randomBytes } from "node:crypto";

import type { TooLostConfig, TooLostOAuthToken } from "./tooLostTypes";

export const TOO_LOST_API_BASE_URL = "https://api.toolost.com/v1";
export const TOO_LOST_AUTHORIZATION_URL = "https://toolost.com/oauth/authorize";
export const TOO_LOST_TOKEN_URL = "https://toolost.com/oauth/token";
export const TOO_LOST_CALLBACK_URL = "https://app.tracksyra.com/auth/toolost/callback";

export const TOO_LOST_DEFAULT_SCOPES = [
  "read:catalog",
  "read:analytics",
  "read:releases",
  "read:profile",
  "read:preferences",
  "write:releases",
  "write:preferences",
  "read:earnings",
  "read:audience",
  "read:sales",
] as const;

export type TooLostPkcePair = {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
};

export type TooLostAuthorizationUrlInput = {
  clientId: string;
  redirectUri: string;
  scopes?: readonly string[];
  state?: string;
  codeVerifier?: string;
  codeChallenge?: string;
  authorizeUrl?: string;
  additionalParams?: Record<string, string | number | boolean | null | undefined>;
};

export type TooLostTokenExchangeInput = {
  code: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenUrl?: string;
  fetchImpl?: typeof fetch;
};

export type TooLostTokenRefreshInput = {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  tokenUrl?: string;
  fetchImpl?: typeof fetch;
};

export type TooLostOAuthEnvironment = Pick<
  TooLostConfig,
  "clientId" | "clientSecret" | "redirectUri" | "oauthAuthorizeUrl" | "oauthTokenUrl"
>;

export function createTooLostPkcePair(state = randomBytes(24).toString("hex")): TooLostPkcePair {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { state, codeVerifier, codeChallenge };
}

export function createTooLostAuthorizationUrl(input: TooLostAuthorizationUrlInput): {
  url: string;
  pkce: TooLostPkcePair;
} {
  if (!input.clientId) throw new Error("Too Lost client ID is required.");
  if (!input.redirectUri) throw new Error("Too Lost redirect URI is required.");

  const pkce = input.codeVerifier && input.codeChallenge
    ? {
        state: input.state ?? randomBytes(24).toString("hex"),
        codeVerifier: input.codeVerifier,
        codeChallenge: input.codeChallenge,
      }
    : createTooLostPkcePair(input.state);

  const authorizeUrl = new URL(input.authorizeUrl ?? TOO_LOST_AUTHORIZATION_URL);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", input.clientId);
  authorizeUrl.searchParams.set("redirect_uri", input.redirectUri);
  authorizeUrl.searchParams.set("scope", [...(input.scopes ?? TOO_LOST_DEFAULT_SCOPES)].join(" "));
  authorizeUrl.searchParams.set("state", pkce.state);
  authorizeUrl.searchParams.set("code_challenge", pkce.codeChallenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  for (const [key, value] of Object.entries(input.additionalParams ?? {})) {
    if (value === null || value === undefined) continue;
    authorizeUrl.searchParams.set(key, String(value));
  }

  return { url: authorizeUrl.toString(), pkce };
}

export async function exchangeTooLostAuthorizationCode(
  input: TooLostTokenExchangeInput,
): Promise<TooLostOAuthToken> {
  if (!input.code) throw new Error("Too Lost authorization code is required.");
  if (!input.codeVerifier) throw new Error("Too Lost code verifier is required.");
  if (!input.clientId) throw new Error("Too Lost client ID is required.");
  if (!input.clientSecret) throw new Error("Too Lost client secret is required.");
  if (!input.redirectUri) throw new Error("Too Lost redirect URI is required.");

  const response = await (input.fetchImpl ?? fetch)(input.tokenUrl ?? TOO_LOST_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      code_verifier: input.codeVerifier,
      redirect_uri: input.redirectUri,
      client_id: input.clientId,
      client_secret: input.clientSecret,
    }),
  });

  return parseTooLostTokenResponse(response, "Too Lost token exchange failed.");
}

export async function refreshTooLostAccessToken(
  input: TooLostTokenRefreshInput,
): Promise<TooLostOAuthToken> {
  if (!input.refreshToken) throw new Error("Too Lost refresh token is required.");
  if (!input.clientId) throw new Error("Too Lost client ID is required.");
  if (!input.clientSecret) throw new Error("Too Lost client secret is required.");

  const response = await (input.fetchImpl ?? fetch)(input.tokenUrl ?? TOO_LOST_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: input.refreshToken,
      client_id: input.clientId,
      client_secret: input.clientSecret,
    }),
  });

  return parseTooLostTokenResponse(response, "Too Lost token refresh failed.", input.refreshToken);
}

export function resolveTooLostOAuthEnvironment(): TooLostOAuthEnvironment {
  const env = process.env;
  return {
    clientId: env.TOO_LOST_CLIENT_ID ?? "",
    clientSecret: env.TOO_LOST_CLIENT_SECRET ?? "",
    redirectUri: env.TOO_LOST_REDIRECT_URI ?? TOO_LOST_CALLBACK_URL,
    oauthAuthorizeUrl: env.TOO_LOST_AUTHORIZE_URL ?? TOO_LOST_AUTHORIZATION_URL,
    oauthTokenUrl: env.TOO_LOST_TOKEN_URL ?? TOO_LOST_TOKEN_URL,
  };
}

function parseTooLostTokenResponse(
  response: Response,
  failureMessage: string,
  fallbackRefreshToken?: string,
): Promise<TooLostOAuthToken> {
  return response.json().then((body: unknown) => {
    const payload = body as Record<string, unknown> | null;
    if (!response.ok) {
      const description = typeof payload?.error_description === "string"
        ? payload.error_description
        : typeof payload?.message === "string"
          ? payload.message
          : response.statusText;
      throw new Error(`${failureMessage} ${description}`.trim());
    }

    const expiresIn = payload && typeof payload.expires_in === "number"
      ? payload.expires_in
      : payload && typeof payload.expires_in === "string"
        ? Number(payload.expires_in)
        : null;

    const refreshToken = payload && typeof payload.refresh_token === "string"
      ? payload.refresh_token
      : fallbackRefreshToken ?? null;

    const scope = payload && typeof payload.scope === "string" ? payload.scope : null;

    return {
      accessToken: String(payload?.access_token ?? ""),
      refreshToken,
      expiresAt: expiresIn && Number.isFinite(expiresIn)
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : null,
      tokenType: "Bearer",
      scope,
    };
  });
}

import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient;

export const SIGNED_AUDIO_URL_TTL_SECONDS = 60 * 60 * 24;

export type DistributionAudioUrlResolver = (value: string | null | undefined) => Promise<ResolvedDistributionAudioUrl>;

export type ResolvedDistributionAudioUrl = {
  originalValue: string | null;
  resolvedAudioUrl: string | null;
  signedAudioUrl: string | null;
  storagePath: string | null;
};

export async function resolveDistributionAudioUrl(
  value: string | null | undefined,
  client: DbClient,
): Promise<ResolvedDistributionAudioUrl> {
  const originalValue = typeof value === "string" ? value.trim() : "";
  console.info("[distributionMediaResolver] resolveDistributionAudioUrl.start", {
    originalValue: originalValue || null,
  });
  if (!originalValue) {
    return {
      originalValue: null,
      resolvedAudioUrl: null,
      signedAudioUrl: null,
      storagePath: null,
    };
  }

  if (/^https?:\/\//i.test(originalValue)) {
    console.info("[distributionMediaResolver] resolveDistributionAudioUrl.external", {
      originalValue,
    });
    return {
      originalValue,
      resolvedAudioUrl: originalValue,
      signedAudioUrl: originalValue,
      storagePath: null,
    };
  }

  const storagePath = normalizeAudioStoragePath(originalValue);
  const { data, error } = await client.storage
    .from("audio")
    .createSignedUrl(storagePath, SIGNED_AUDIO_URL_TTL_SECONDS);
  if (error) throw new Error(`Failed to create signed audio URL for distribution: ${error.message}`);
  console.info("[distributionMediaResolver] resolveDistributionAudioUrl.signed", {
    originalValue,
    storagePath,
    signedAudioUrl: data.signedUrl,
    ttlSeconds: SIGNED_AUDIO_URL_TTL_SECONDS,
  });

  return {
    originalValue,
    resolvedAudioUrl: data.signedUrl,
    signedAudioUrl: data.signedUrl,
    storagePath,
  };
}

export function createDistributionAudioUrlResolver(client: DbClient): DistributionAudioUrlResolver {
  return (value) => resolveDistributionAudioUrl(value, client);
}

function normalizeAudioStoragePath(value: string): string {
  const trimmed = value.trim().replace(/^\/+/, "");
  return trimmed.startsWith("audio/") ? trimmed.slice("audio/".length) : trimmed;
}

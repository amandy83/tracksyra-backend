export type ProviderFeatureFlags = Readonly<Record<string, boolean>>;

export function mergeProviderFeatureFlags(
  ...flags: Array<ProviderFeatureFlags | null | undefined>
): ProviderFeatureFlags {
  const merged: Record<string, boolean> = {};
  for (const flagSet of flags) {
    if (!flagSet) continue;
    for (const [key, value] of Object.entries(flagSet)) merged[key] = Boolean(value);
  }
  return Object.freeze(merged);
}


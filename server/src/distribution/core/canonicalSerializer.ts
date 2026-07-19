interface CanonicalObject {
  readonly [key: string]: CanonicalValue;
}

type CanonicalArray = ReadonlyArray<CanonicalValue>;

type CanonicalValue =
  | null
  | boolean
  | number
  | string
  | CanonicalArray
  | CanonicalObject;

function normalize(value: unknown): CanonicalValue {
  if (value === null) return null;
  if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Buffer.isBuffer(value)) {
    return value.toString("base64");
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString("base64");
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => normalize(entry)));
  }
  if (!value || typeof value !== "object") {
    return String(value) as CanonicalValue;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => [key, normalize(entry)] as const);

  return Object.freeze(Object.fromEntries(entries)) as CanonicalObject;
}

export function serializeCanonicalJSON(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export function canonicalizeJSON<T>(value: T): T {
  if (value == null || typeof value !== "object") {
    return value;
  }
  return JSON.parse(serializeCanonicalJSON(value)) as T;
}

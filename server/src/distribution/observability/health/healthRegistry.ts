import type { HealthCategory } from "../types/observabilityTypes";
import type { HealthStatus } from "./healthStatus";

export type HealthRegistryEntry = Readonly<{
  componentId: string;
  category: HealthCategory;
  status: HealthStatus;
  registeredAt: string;
}>;

export type HealthRegistrySnapshot = Readonly<{
  generatedAt: string;
  entries: readonly HealthRegistryEntry[];
}>;


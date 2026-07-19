import type { HealthSnapshot } from "../../composition";

export interface BootstrapHealthChecker {
  check(): Promise<HealthSnapshot> | HealthSnapshot;
}

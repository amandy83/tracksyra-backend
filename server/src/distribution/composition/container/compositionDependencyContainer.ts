import type { CompositionConfiguration } from "../types/compositionTypes";

export interface CompositionDependencyContainer {
  register<T>(token: string, value: T): void;
  resolve<T>(token: string): T | null;
  has(token: string): boolean;
  override<T>(token: string, value: T): void;
  list(): readonly string[];
  configuration(): CompositionConfiguration | null;
}

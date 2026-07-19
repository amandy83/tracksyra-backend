import type { CompositionConfiguration, CompositionSnapshot } from "../types/compositionTypes";

export interface CompositionLifecycleManager {
  create(configuration: CompositionConfiguration): CompositionSnapshot;
  start(snapshot: CompositionSnapshot): CompositionSnapshot;
  run(snapshot: CompositionSnapshot): CompositionSnapshot;
  stop(snapshot: CompositionSnapshot): CompositionSnapshot;
  fail(snapshot: CompositionSnapshot): CompositionSnapshot;
}

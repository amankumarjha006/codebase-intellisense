import type { DataFlowOut } from './types';

export interface StepHighlightResult {
  highlightedComponentIds: Set<string>;
  highlightedEdgeKeys: Set<string>;
}

/**
 * Pure function that selects the active component and directional edge to highlight
 * for a chosen step in an architectural data flow.
 */
export function selectStepHighlight(
  flow?: DataFlowOut | null,
  stepIndex?: number | null
): StepHighlightResult {
  const result: StepHighlightResult = {
    highlightedComponentIds: new Set<string>(),
    highlightedEdgeKeys: new Set<string>(),
  };

  if (!flow || stepIndex === undefined || stepIndex === null || stepIndex < 0) {
    return result;
  }

  const steps = flow.steps || [];
  if (stepIndex >= steps.length) {
    return result;
  }

  const currentStep = steps[stepIndex];
  if (currentStep?.component_id) {
    result.highlightedComponentIds.add(currentStep.component_id);
  }

  // Highlight connection to next step if sequential
  if (stepIndex + 1 < steps.length) {
    const nextStep = steps[stepIndex + 1];
    if (nextStep?.component_id) {
      result.highlightedComponentIds.add(nextStep.component_id);
      result.highlightedEdgeKeys.add(`${currentStep.component_id}->${nextStep.component_id}`);
    }
  }

  return result;
}


import type { DesignAction, DesignInteraction, DesignIR } from './design-ir';

export type StudioRuntimeState = {
  screenId: string;
  screenStateId: string;
  values: Record<string, string | boolean>;
  overlays: string[];
  history: string[];
  emittedActions: string[];
  scrollTargetId?: string;
  submitted: boolean;
};

export type StudioRuntimeEvent = 'press' | 'change' | 'submit' | 'select' | 'toggle';

export function createStudioRuntimeState(ir: DesignIR): StudioRuntimeState {
  return { screenId: ir.screenId, screenStateId: ir.screenStateId, values: {}, overlays: [], history: [], emittedActions: [], submitted: false };
}

function applyAction(state: StudioRuntimeState, action: DesignAction, inputValue?: string | boolean): StudioRuntimeState {
  if (action.type === 'set_state' && action.stateId) return { ...state, screenStateId: action.stateId };
  if (action.type === 'navigate' && action.screenId) return { ...state, history: [...state.history, state.screenId], screenId: action.screenId, ...(action.stateId ? { screenStateId: action.stateId } : {}) };
  if (action.type === 'back') {
    const history = [...state.history];
    const screenId = history.pop() ?? state.screenId;
    return { ...state, screenId, history };
  }
  if (action.type === 'open_overlay' && action.overlayId) return state.overlays.includes(action.overlayId) ? state : { ...state, overlays: [...state.overlays, action.overlayId] };
  if (action.type === 'close_overlay') return action.overlayId ? { ...state, overlays: state.overlays.filter((id) => id !== action.overlayId) } : { ...state, overlays: state.overlays.slice(0, -1) };
  if (action.type === 'scroll_to' && action.targetId) return { ...state, scrollTargetId: action.targetId };
  if (action.type === 'emit_design_action' && action.actionId) return { ...state, emittedActions: [...state.emittedActions, action.actionId] };
  if (action.type === 'submit_mock') return { ...state, submitted: true };
  if ((action.type === 'set_input' || action.type === 'select') && action.path) return { ...state, values: { ...state.values, [action.path]: action.value ?? String(inputValue ?? '') } };
  if (action.type === 'toggle' && action.path) {
    const current = state.values[action.path];
    const next = typeof inputValue === 'boolean' ? inputValue : !Boolean(current);
    return { ...state, values: { ...state.values, [action.path]: next } };
  }
  return state;
}

export function executeDesignInteractions(
  state: StudioRuntimeState,
  interactions: DesignInteraction[],
  event: StudioRuntimeEvent,
  inputValue?: string | boolean,
): StudioRuntimeState {
  return interactions.filter((item) => item.event === event).reduce((next, item) => item.actions.reduce((value, action) => applyAction(value, action, inputValue), next), state);
}

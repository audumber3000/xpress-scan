// Imperative handle exposed by each Utilities tab so the screen-level header
// "+" button can trigger that tab's create flow.
export interface UtilityTabHandle {
  openCreate: () => void;
}

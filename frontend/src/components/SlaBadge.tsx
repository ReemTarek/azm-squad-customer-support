import type { SlaState } from "../lib/ticketsApi";

const LABELS: Record<SlaState, string> = {
  on_track: "On track",
  at_risk: "At risk",
  breached: "Breached",
};

const STATE_CLASSES: Record<SlaState, string> = {
  on_track: "bg-success",
  at_risk: "bg-warning text-dark",
  breached: "bg-danger",
};

export function SlaBadge({ state }: { state: SlaState }) {
  return <span className={`badge ${STATE_CLASSES[state]}`}>{LABELS[state]}</span>;
}

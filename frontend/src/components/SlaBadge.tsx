import type { SlaState } from "../lib/ticketsApi";

const LABELS: Record<SlaState, string> = {
  on_track: "On track",
  at_risk: "At risk",
  breached: "Breached",
};

export function SlaBadge({ state }: { state: SlaState }) {
  return <span className={`sla-badge sla-badge--${state}`}>{LABELS[state]}</span>;
}

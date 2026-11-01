import type { Phase } from "@arp/contracts";
import { CalendarClock, CircleCheckBig, Radio } from "lucide-react";
import { StatusBadge } from "./StatusBadge";

export const PHASE_LABEL: Record<Phase, string> = {
  upcoming: "Em breve",
  live: "No ar",
  ended: "Encerrada",
};

/** Fase em relação a agora (campanha, destaque): em breve, no ar, encerrada. */
export function PhaseBadge({ phase, ended = PHASE_LABEL.ended }: { phase: Phase; ended?: string }) {
  if (phase === "live")
    return (
      <StatusBadge tone="brand" icon={Radio}>
        {PHASE_LABEL.live}
      </StatusBadge>
    );
  if (phase === "upcoming")
    return (
      <StatusBadge tone="info" icon={CalendarClock}>
        {PHASE_LABEL.upcoming}
      </StatusBadge>
    );
  return (
    <StatusBadge tone="neutral" icon={CircleCheckBig}>
      {ended}
    </StatusBadge>
  );
}

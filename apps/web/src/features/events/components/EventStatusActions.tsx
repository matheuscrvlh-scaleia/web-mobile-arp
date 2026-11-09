import type { Event } from "@arp/contracts";
import { Button } from "@/shared/ui";
import { useEventActions } from "./useEventActions";

/** Cabeçalho do detalhe: mostrar ou não no app (o resto vem do site). */
export function EventStatusActions({ event }: { event: Event }) {
  const { action, busy, shown } = useEventActions(event);
  return (
    <Button
      variant={shown ? "secondary" : "brand"}
      icon={action.icon}
      loading={busy}
      onClick={action.run}
    >
      {action.label}
    </Button>
  );
}

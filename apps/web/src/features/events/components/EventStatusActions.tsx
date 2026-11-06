import type { Event } from "@arp/contracts";
import { useNavigate } from "react-router";
import { PATHS } from "@/shared/config/paths";
import { ActionMenu, Button } from "@/shared/ui";
import { useEventActions } from "./useEventActions";

/**
 * Cabeçalho do detalhe: a ação principal do status atual (Publicar, Pausar,
 * Retomar, Desarquivar…) e o "⋯" com Adiar, Cancelar, Duplicar, Arquivar e
 * Excluir (por último, em vermelho).
 */
export function EventStatusActions({ event }: { event: Event }) {
  const navigate = useNavigate();
  const { primary, menu, dialogs, busy } = useEventActions(event, {
    onDeleted: () => navigate(PATHS.events),
  });
  return (
    <>
      {primary && (
        <Button variant="brand" icon={primary.icon} loading={busy} onClick={primary.run}>
          {primary.label}
        </Button>
      )}
      <ActionMenu items={menu} label="Mais" ariaLabel={`Mais ações de ${event.title}`} />
      {dialogs}
    </>
  );
}

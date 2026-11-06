import type { Highlight, HighlightStatus } from "@arp/contracts";
import { Archive, ArchiveRestore, Copy, type LucideIcon, Radio, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useNavigate } from "react-router";
import { errorMessage } from "@/shared/api";
import { PATHS } from "@/shared/config/paths";
import { duplicateHref } from "@/shared/hooks";
import { plural } from "@/shared/lib/format";
import { type ActionMenuItems, ConfirmDialog, toast } from "@/shared/ui";
import { useDeleteHighlight, useUpdateHighlight } from "../api";

export interface PrimaryAction {
  label: string;
  icon: LucideIcon;
  run: () => void;
}

const DONE: Record<HighlightStatus, string> = {
  draft: "voltou para rascunho",
  published: "está no ar",
  paused: "pausado: saiu do carrossel",
  archived: "arquivado",
};

/**
 * Ciclo de vida do destaque (detalhe, linha e switch "No ar"): tudo
 * reversível aplica na hora com "Desfazer"; excluir confirma e só vale para
 * destaque que nunca apareceu.
 */
export function useHighlightActions(h: Highlight, { onDeleted }: { onDeleted?: () => void } = {}) {
  const navigate = useNavigate();
  const update = useUpdateHighlight(h.id);
  const remove = useDeleteHighlight();
  const [deleting, setDeleting] = useState(false);

  // mutateAsync (e não callbacks do mutate): arquivar move o item de seção e
  // desmonta a linha; o retorno do mutate de um item desmontado não roda.
  const setStatus = (status: HighlightStatus) => {
    const before = h.status;
    const done =
      before === "archived"
        ? "desarquivado: está pausado, ligue “Ativo” para voltar ao carrossel"
        : DONE[status];
    update.mutateAsync({ status }).then(
      () =>
        toast.success(`“${h.title}” ${done}.`, {
          action: {
            label: "Desfazer",
            onClick: () =>
              update
                .mutateAsync({ status: before })
                .then(() => toast.success(`“${h.title}” voltou como estava.`))
                .catch((e) => toast.error(errorMessage(e))),
          },
        }),
      (e) => toast.error(errorMessage(e)),
    );
  };

  /** Switch "No ar": publicado ↔ pausado (rascunho liga = publica). */
  const live = h.status === "published";
  const toggleLive = () => setStatus(live ? "paused" : "published");

  const primary: PrimaryAction | null =
    h.status === "archived"
      ? { label: "Desarquivar", icon: ArchiveRestore, run: () => setStatus("paused") }
      : h.status === "draft"
        ? { label: "Publicar", icon: Radio, run: () => setStatus("published") }
        : null;

  const views = h.impressions;
  const menu: ActionMenuItems = [
    {
      label: "Duplicar",
      icon: Copy,
      onSelect: () => navigate(duplicateHref(PATHS.highlightNew, h.id)),
    },
    h.status !== "archived" && {
      label: "Arquivar",
      icon: Archive,
      onSelect: () => setStatus("archived"),
    },
    {
      label: "Excluir",
      icon: Trash2,
      danger: true,
      disabled: views > 0,
      hint:
        views > 0
          ? `Já teve ${plural(views, "exibição", "exibições")}: arquive para guardar os números`
          : undefined,
      onSelect: () => setDeleting(true),
    },
  ];

  const dialogs: ReactNode = (
    <ConfirmDialog
      open={deleting}
      onClose={() => {
        setDeleting(false);
        remove.reset();
      }}
      danger
      title={`Excluir “${h.title}”?`}
      description="Ele nunca apareceu no app. Some do carrossel e do painel de vez."
      confirmLabel="Excluir destaque"
      loading={remove.isPending}
      error={remove.error}
      onConfirm={() =>
        remove.mutate(h.id, {
          onSuccess: () => {
            setDeleting(false);
            toast.success(`“${h.title}” excluído.`);
            onDeleted?.();
          },
        })
      }
    />
  );

  return { primary, menu, dialogs, live, toggleLive, busy: update.isPending };
}

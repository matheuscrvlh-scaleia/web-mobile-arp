import type { Event } from "@arp/contracts";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";
import { errorMessage } from "@/shared/api";
import { toast } from "@/shared/ui";
import { useArchiveEvent, useUpdateEvent } from "../api";

export interface VisibilityAction {
  label: string;
  icon: LucideIcon;
  run: () => void;
}

/** No app = publicado e não arquivado. */
export const isShownInApp = (event: Event) => event.status === "published" && !event.archivedAt;

/**
 * O evento vem do site e não se edita aqui: a única ação é mostrar ou não
 * no app. Não mostrar = pausado (sai do app); mostrar = publicado
 * (desarquiva antes, se preciso). Aplica na hora, com "Desfazer".
 */
export function useEventActions(event: Event) {
  const update = useUpdateEvent(event.id);
  const archive = useArchiveEvent();
  const busy = update.isPending || archive.isPending;
  const shown = isShownInApp(event);

  const fail = (e: unknown) => toast.error(errorMessage(e));

  const show = () =>
    (event.archivedAt ? archive.mutateAsync({ id: event.id, archived: false }) : Promise.resolve())
      .then(() => update.mutateAsync({ status: "published" }))
      .then(
        () =>
          toast.success(`“${event.title}” está no app.`, {
            action: { label: "Desfazer", onClick: () => void hide(true) },
          }),
        fail,
      );

  const hide = (quiet = false) =>
    update.mutateAsync({ status: "paused" }).then(
      () =>
        quiet
          ? toast.success(`“${event.title}” voltou como estava.`)
          : toast.success(`“${event.title}” saiu do app.`, {
              action: { label: "Desfazer", onClick: () => void show() },
            }),
      fail,
    );

  const action: VisibilityAction = shown
    ? { label: "Não mostrar no app", icon: EyeOff, run: () => void hide() }
    : { label: "Mostrar no app", icon: Eye, run: () => void show() };

  return { action, busy, shown };
}

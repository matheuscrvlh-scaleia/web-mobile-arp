import type { Event, EventStatus } from "@arp/contracts";
import { CircleOff, Pause, Play, Radio, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { PATHS } from "@/shared/config/paths";
import { Button, ConfirmDialog, toast } from "@/shared/ui";
import { useDeleteEvent, useUpdateEvent } from "../api";

type Action = "publish" | "pause" | "resume" | "cancel" | "delete";

const CONFIRM: Record<
  Action,
  { title: string; description: string; label: string; danger: boolean }
> = {
  publish: {
    title: "Publicar o evento?",
    description: "Ele passa a aparecer na agenda do app.",
    label: "Publicar",
    danger: false,
  },
  pause: {
    title: "Pausar o evento?",
    description: "Ele sai da agenda do app até você continuar. Quem tinha interesse não é avisado.",
    label: "Pausar",
    danger: false,
  },
  resume: {
    title: "Continuar o evento?",
    description: "Ele volta a aparecer na agenda do app.",
    label: "Continuar",
    danger: false,
  },
  cancel: {
    title: "Cancelar o evento?",
    description:
      "Ele continua visível no app como cancelado, para quem tinha interesse saber. Dá para publicar de novo.",
    label: "Cancelar evento",
    danger: true,
  },
  delete: {
    title: "Apagar o rascunho?",
    description: "O rascunho some de vez. Não dá para desfazer.",
    label: "Apagar",
    danger: true,
  },
};

const NEXT_STATUS: Record<Exclude<Action, "delete">, EventStatus> = {
  publish: "published",
  pause: "paused",
  resume: "published",
  cancel: "cancelled",
};

const DONE: Record<Exclude<Action, "delete">, string> = {
  publish: "Evento publicado.",
  pause: "Evento pausado: saiu do app.",
  resume: "Evento de volta no app.",
  cancel: "Evento cancelado.",
};

/** Publicar, pausar/continuar, cancelar ou apagar rascunho (sempre com confirmação). */
export function EventStatusActions({ event }: { event: Event }) {
  const navigate = useNavigate();
  const update = useUpdateEvent(event.id);
  const remove = useDeleteEvent();
  const [action, setAction] = useState<Action | null>(null);
  const pending = update.isPending || remove.isPending;

  const close = () => {
    setAction(null);
    update.reset();
    remove.reset();
  };

  const confirm = () => {
    if (action === "delete") {
      remove.mutate(event.id, {
        onSuccess: () => {
          toast.success("Rascunho apagado.");
          setAction(null);
          navigate(PATHS.events);
        },
      });
    } else if (action) {
      update.mutate(
        { status: NEXT_STATUS[action] },
        {
          onSuccess: () => {
            toast.success(DONE[action]);
            setAction(null);
          },
        },
      );
    }
  };

  const c = action ? CONFIRM[action] : null;
  return (
    <>
      {event.status === "draft" && (
        <Button variant="ghost" icon={Trash2} onClick={() => setAction("delete")}>
          Apagar rascunho
        </Button>
      )}
      {(event.status === "published" || event.status === "paused") && (
        <Button variant="ghost" icon={CircleOff} onClick={() => setAction("cancel")}>
          Cancelar evento
        </Button>
      )}
      {event.status === "published" && (
        <Button variant="secondary" icon={Pause} onClick={() => setAction("pause")}>
          Pausar
        </Button>
      )}
      {event.status === "paused" && (
        <Button variant="brand" icon={Play} onClick={() => setAction("resume")}>
          Continuar
        </Button>
      )}
      {(event.status === "draft" || event.status === "cancelled") && (
        <Button variant="brand" icon={Radio} onClick={() => setAction("publish")}>
          {event.status === "cancelled" ? "Publicar de novo" : "Publicar"}
        </Button>
      )}
      <ConfirmDialog
        open={c !== null}
        onClose={close}
        onConfirm={confirm}
        title={c?.title ?? ""}
        description={c?.description}
        confirmLabel={c?.label ?? ""}
        danger={c?.danger}
        loading={pending}
        error={update.error ?? remove.error}
      />
    </>
  );
}

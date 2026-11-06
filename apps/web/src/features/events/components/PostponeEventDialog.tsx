import type { Event } from "@arp/contracts";
import { CalendarClock } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { errorMessage } from "@/shared/api";
import { PATHS } from "@/shared/config/paths";
import { addDaysIso, todayIso } from "@/shared/lib/dates";
import { Button, Field, FormError, Input, Modal, toast } from "@/shared/ui";
import { usePostponeEvent } from "../api";
import { describeWhen } from "../lib/when";

/** Dias entre duas datas ISO (pode ser negativo). */
function shiftDays(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

/**
 * Adiar: escolhe a nova data de início; o fim do período anda junto. Depois,
 * o aviso oferece criar um push já preenchido para quem acompanha o evento.
 */
export function PostponeEventDialog({
  event,
  onClose,
}: {
  event: Event | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const postpone = usePostponeEvent(event?.id ?? "");
  const [startsOn, setStartsOn] = useState("");

  useEffect(() => {
    if (event)
      setStartsOn(addDaysIso(event.startsOn < todayIso() ? todayIso() : event.startsOn, 7));
  }, [event]);

  if (!event) return null;
  const shift = startsOn ? shiftDays(event.startsOn, startsOn) : 0;
  const endsOn = event.endsOn && startsOn ? addDaysIso(event.endsOn, shift) : event.endsOn;
  const close = () => {
    postpone.reset();
    onClose();
  };

  return (
    <Modal
      open
      onClose={close}
      busy={postpone.isPending}
      title={`Adiar “${event.title}”`}
      description={`Hoje: ${describeWhen(event)}.`}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={postpone.isPending}>
            Voltar
          </Button>
          <Button
            icon={CalendarClock}
            loading={postpone.isPending}
            disabled={!startsOn || shift === 0}
            onClick={() =>
              postpone.mutate(
                { startsOn },
                {
                  onSuccess: (saved) => {
                    close();
                    toast.success(`“${saved.title}” adiado: ${describeWhen(saved)}.`, {
                      action: {
                        label: "Avisar por push",
                        onClick: () =>
                          navigate(`${PATHS.notificationNew}?evento=${saved.id}&motivo=adiado`),
                      },
                    });
                  },
                  onError: (e) => toast.error(errorMessage(e)),
                },
              )
            }
          >
            Adiar evento
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label={event.recurrence === "weekly" ? "Recomeça a partir de" : "Nova data de início"}
          required
        >
          <Input
            type="date"
            value={startsOn}
            min={todayIso()}
            onChange={(e) => setStartsOn(e.target.value)}
          />
        </Field>
        {startsOn && shift !== 0 && (
          <p className="rounded-2xl bg-neutral-900/[0.05] px-4 py-3 text-sm text-neutral-700">
            <span className="text-neutral-500">Fica assim no app: </span>
            <b className="font-semibold">
              {describeWhen({ ...event, startsOn, endsOn: endsOn ?? null })}
            </b>
          </p>
        )}
        <FormError message={postpone.error ? errorMessage(postpone.error) : null} />
      </div>
    </Modal>
  );
}

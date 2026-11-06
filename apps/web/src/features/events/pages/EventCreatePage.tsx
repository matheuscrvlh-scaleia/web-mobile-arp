import { CalendarClock } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { PATHS } from "@/shared/config/paths";
import { useDuplicateSource } from "@/shared/hooks";
import { LoadingRegion, PageHeader, Skeleton, toast } from "@/shared/ui";
import { useCreateEvent, useEvent } from "../api";
import { EventForm } from "../components/form/EventForm";
import { cleanRecurrence, EVENT_FORM_FIELDS } from "../lib/form";
import { longDay } from "../lib/when";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Novo evento; `?de=<id>` = "Duplicar" e `?dia=AAAA-MM-DD` = clique no calendário. */
export function EventCreatePage() {
  const navigate = useNavigate();
  const create = useCreateEvent();
  const sourceId = useDuplicateSource();
  const source = useEvent(sourceId ?? undefined);
  const [params] = useSearchParams();
  const day = params.get("dia");
  const initialStartsOn = day && ISO_DAY.test(day) ? day : undefined;

  if (sourceId && !source.data && !source.error) {
    return (
      <LoadingRegion>
        <Skeleton className="h-12 w-96 max-w-full rounded-full" />
        <Skeleton className="h-[40rem] rounded-[1.75rem]" />
      </LoadingRegion>
    );
  }

  return (
    <>
      <PageHeader
        title={source.data ? "Duplicar evento" : "Novo evento"}
        description={
          source.data
            ? `Cópia de “${source.data.title}”. Revise as datas antes de salvar: a cópia nasce como rascunho.`
            : initialStartsOn
              ? `Dia escolhido no calendário: ${longDay(initialStartsOn)}.`
              : "Um dia, um período (até o mês inteiro) ou toda semana."
        }
        back={{ to: PATHS.events, label: "Eventos" }}
      />
      {source.data && (
        <p className="mb-4 flex items-center gap-2 rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-800">
          <CalendarClock className="size-4 shrink-0" aria-hidden />
          As datas vieram do evento original: confira o “Quando” antes de salvar.
        </p>
      )}
      <EventForm
        copyOf={source.data}
        initialStartsOn={initialStartsOn}
        submitLabel="Criar evento"
        saving={create.isPending}
        onSubmit={(values, { form, allowLeave }) =>
          create.mutate(cleanRecurrence(values), {
            onSuccess: ({ id }) => {
              toast.success(
                values.status === "published" ? "Evento publicado." : "Rascunho criado.",
              );
              allowLeave();
              navigate(PATHS.event(id));
            },
            onError: (e) => {
              if (!applyApiErrors(e, form.setError, EVENT_FORM_FIELDS))
                toast.error(errorMessage(e));
            },
          })
        }
      />
    </>
  );
}

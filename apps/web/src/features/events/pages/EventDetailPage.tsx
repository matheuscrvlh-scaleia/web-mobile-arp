import type { Event } from "@arp/contracts";
import { CalendarX2, Heart } from "lucide-react";
import { useParams } from "react-router";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { formatDateTime, formatNumber } from "@/shared/lib/format";
import { LoadError, LoadingRegion, PageHeader, Skeleton, toast } from "@/shared/ui";
import { useEvent, useUpdateEvent } from "../api";
import { EventStatusBadge, SealPill } from "../components/EventBadges";
import { EventStatusActions } from "../components/EventStatusActions";
import { EventForm } from "../components/form/EventForm";
import { EVENT_FORM_FIELDS, eventPatch } from "../lib/form";
import { describeWhen } from "../lib/when";

export function EventDetailPage() {
  const { id = "" } = useParams();
  const event = useEvent(id);

  if (event.error) {
    return (
      <LoadError
        error={event.error}
        onRetry={() => void event.refetch()}
        icon={CalendarX2}
        title="Evento não encontrado"
        description="Ele pode ter sido apagado ou o endereço está errado."
        back={{ to: PATHS.events, label: "Ver a agenda" }}
      />
    );
  }

  if (!event.data) {
    return (
      <LoadingRegion>
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-12 w-96 max-w-full rounded-full" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <Skeleton className="h-[40rem] rounded-[1.75rem]" />
          <Skeleton className="hidden h-[28rem] rounded-[1.75rem] xl:block" />
        </div>
      </LoadingRegion>
    );
  }

  return <EventEditor event={event.data} />;
}

function EventEditor({ event }: { event: Event }) {
  const { can } = useAuth();
  const update = useUpdateEvent(event.id);
  const canEdit = can("events.manage");

  return (
    <>
      <PageHeader
        title={event.title}
        back={{ to: PATHS.events, label: "Eventos" }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <EventStatusBadge status={event.status} />
            {event.awardsSeal && <SealPill />}
            <span>{describeWhen(event)}</span>
            <span className="inline-flex items-center gap-1">
              <Heart className="size-3.5" aria-hidden />
              {formatNumber(event.interestsCount)} com interesse
            </span>
            <span className="text-neutral-400">Editado em {formatDateTime(event.updatedAt)}</span>
          </span>
        }
        actions={canEdit && <EventStatusActions event={event} />}
      />
      <EventForm
        event={event}
        readOnly={!canEdit}
        submitLabel="Salvar evento"
        saving={update.isPending}
        onSubmit={(values, { form }) => {
          const body = eventPatch(values, form.formState.dirtyFields);
          if (Object.keys(body).length === 0) return;
          update.mutate(body, {
            onSuccess: () => {
              form.reset(values);
              toast.success("Evento salvo.");
            },
            onError: (e) => {
              if (!applyApiErrors(e, form.setError, EVENT_FORM_FIELDS))
                toast.error(errorMessage(e));
            },
          });
        }}
      />
    </>
  );
}

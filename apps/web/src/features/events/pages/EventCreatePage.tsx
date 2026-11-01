import { useNavigate } from "react-router";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { PATHS } from "@/shared/config/paths";
import { PageHeader, toast } from "@/shared/ui";
import { useCreateEvent } from "../api";
import { EventForm } from "../components/form/EventForm";
import { cleanRecurrence, EVENT_FORM_FIELDS } from "../lib/form";

export function EventCreatePage() {
  const navigate = useNavigate();
  const create = useCreateEvent();
  return (
    <>
      <PageHeader
        title="Novo evento"
        description="Um dia, um período (até o mês inteiro) ou toda semana."
        back={{ to: PATHS.events, label: "Eventos" }}
      />
      <EventForm
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

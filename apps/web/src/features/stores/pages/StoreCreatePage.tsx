import { useNavigate } from "react-router";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { PATHS } from "@/shared/config/paths";
import { PageHeader, toast } from "@/shared/ui";
import { useCreateStore } from "../api";
import { STORE_FORM_FIELDS, StoreForm } from "../components/StoreForm";

export function StoreCreatePage() {
  const navigate = useNavigate();
  const create = useCreateStore();
  return (
    <>
      <PageHeader
        title="Nova loja"
        description="Depois de criar, defina os horários e o ponto no mapa."
        back={{ to: PATHS.stores, label: "Lojas" }}
      />
      <StoreForm
        submitLabel="Criar loja"
        saving={create.isPending}
        onSubmit={(values, { form, allowLeave }) =>
          create.mutate(
            { ...values, hours: [] },
            {
              onSuccess: ({ id }) => {
                toast.success("Loja criada. Agora, os horários de funcionamento.");
                allowLeave();
                navigate(PATHS.store(id, "horarios"));
              },
              onError: (e) => {
                if (!applyApiErrors(e, form.setError, STORE_FORM_FIELDS))
                  toast.error(errorMessage(e));
              },
            },
          )
        }
      />
    </>
  );
}

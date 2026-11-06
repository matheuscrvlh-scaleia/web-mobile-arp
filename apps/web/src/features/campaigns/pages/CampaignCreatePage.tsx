import { useNavigate } from "react-router";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { PATHS } from "@/shared/config/paths";
import { PageHeader, toast } from "@/shared/ui";
import { useCreateCampaign } from "../api";
import { CAMPAIGN_FORM_FIELDS, CampaignForm } from "../components/CampaignForm";

export function CampaignCreatePage() {
  const navigate = useNavigate();
  const create = useCreateCampaign();
  return (
    <>
      <PageHeader
        title="Nova campanha"
        description="Nasce em rascunho (fora do app). Depois de criar, cadastre os desafios e publique."
        back={{ to: PATHS.campaigns, label: "Campanhas" }}
      />
      <CampaignForm
        submitLabel="Criar campanha"
        saving={create.isPending}
        onSubmit={(values, { form, allowLeave }) =>
          create.mutate(values, {
            onSuccess: ({ id }) => {
              toast.success("Campanha criada em rascunho. Agora, os desafios.");
              allowLeave();
              navigate(PATHS.campaign(id, "desafios"));
            },
            onError: (e) => {
              if (!applyApiErrors(e, form.setError, CAMPAIGN_FORM_FIELDS))
                toast.error(errorMessage(e));
            },
          })
        }
      />
    </>
  );
}

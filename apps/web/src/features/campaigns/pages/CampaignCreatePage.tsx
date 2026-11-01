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
        description="Depois de criar, defina as faixas de benefício e cadastre os desafios."
        back={{ to: PATHS.campaigns, label: "Campanhas" }}
      />
      <CampaignForm
        submitLabel="Criar campanha"
        saving={create.isPending}
        onSubmit={(values, { form, allowLeave }) =>
          create.mutate(values, {
            onSuccess: ({ id }) => {
              toast.success("Campanha criada. Agora, as faixas de benefício.");
              allowLeave();
              navigate(PATHS.campaign(id, "faixas"));
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

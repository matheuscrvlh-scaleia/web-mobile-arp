import { listChallengesQuerySchema } from "@arp/contracts";
import { useNavigate } from "react-router";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { PATHS } from "@/shared/config/paths";
import { useUrlState } from "@/shared/hooks";
import { PageHeader, toast } from "@/shared/ui";
import { useCreateChallenge } from "../api";
import { CHALLENGE_FORM_FIELDS, ChallengeForm } from "../components/ChallengeForm";

export function ChallengeCreatePage() {
  const navigate = useNavigate();
  const [{ campaignId }] = useUrlState(listChallengesQuerySchema);
  const create = useCreateChallenge();
  return (
    <>
      <PageHeader
        title="Novo desafio"
        description="Cada desafio dá um selo. Depois de criar, gere o QR Code."
        back={{
          to: campaignId ? PATHS.challengesOf(campaignId) : PATHS.challenges,
          label: "Desafios",
        }}
      />
      <ChallengeForm
        campaignId={campaignId}
        submitLabel="Criar desafio"
        saving={create.isPending}
        onSubmit={(values, { form, allowLeave }) =>
          create.mutate(values, {
            onSuccess: ({ id }) => {
              toast.success(
                values.validation === "qr"
                  ? "Desafio criado. Agora, gere o QR Code."
                  : "Desafio criado.",
              );
              allowLeave();
              navigate(PATHS.challenge(id));
            },
            onError: (e) => {
              if (!applyApiErrors(e, form.setError, CHALLENGE_FORM_FIELDS))
                toast.error(errorMessage(e));
            },
          })
        }
      />
    </>
  );
}

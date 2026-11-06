import { Target } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { PATHS } from "@/shared/config/paths";
import { useDuplicateSource } from "@/shared/hooks";
import { LoadError, LoadingRegion, PageHeader, Skeleton, toast } from "@/shared/ui";
import { useChallenge, useCreateChallenge } from "../api";
import { CHALLENGE_FORM_FIELDS, ChallengeForm } from "../components/ChallengeForm";

/**
 * Novo desafio. `?campaignId=` já escolhe a campanha (vindo da aba Desafios
 * da campanha); `?de=<id>` duplica um desafio (formulário preenchido, título
 * "(cópia)"). O novo entra no fim da lista da campanha.
 */
export function ChallengeCreatePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const de = useDuplicateSource() ?? undefined;
  const source = useChallenge(de);
  const campaignId = params.get("campaignId") ?? source.data?.campaign.id ?? undefined;
  const create = useCreateChallenge();
  const back = campaignId
    ? { to: PATHS.campaign(campaignId, "desafios"), label: "Desafios da campanha" }
    : { to: PATHS.challenges, label: "Desafios" };

  if (de && source.error) {
    return (
      <LoadError
        error={source.error}
        onRetry={() => void source.refetch()}
        icon={Target}
        title="Desafio para duplicar não encontrado"
        description="Ele pode ter sido excluído."
        back={back}
      />
    );
  }
  if (de && !source.data) {
    return (
      <LoadingRegion>
        <Skeleton className="h-12 w-96 max-w-full rounded-full" />
        <Skeleton className="h-96 rounded-[1.75rem]" />
      </LoadingRegion>
    );
  }

  return (
    <>
      <PageHeader
        title={source.data ? `Duplicar ${source.data.title}` : "Novo desafio"}
        description={
          source.data
            ? "Confira o título e o que mudou. O desafio novo entra no fim da lista, sem QR Codes."
            : "Cada desafio dá um selo. Depois de criar, gere o QR Code."
        }
        back={back}
      />
      <ChallengeForm
        campaignId={campaignId}
        copyOf={source.data}
        submitLabel={source.data ? "Criar cópia" : "Criar desafio"}
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

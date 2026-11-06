import { useNavigate } from "react-router";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { PATHS } from "@/shared/config/paths";
import { useDuplicateSource } from "@/shared/hooks";
import { LoadingRegion, PageHeader, Skeleton, toast } from "@/shared/ui";
import { useCreateHighlight, useHighlight, useHighlights } from "../api";
import { HighlightForm } from "../components/form/HighlightForm";
import { carouselContext } from "../lib/carousel";
import { cleanHighlight, HIGHLIGHT_FORM_FIELDS } from "../lib/form";

export function HighlightCreatePage() {
  const navigate = useNavigate();
  const create = useCreateHighlight();
  const all = useHighlights();
  const { next, total } = carouselContext(all.data);
  const sourceId = useDuplicateSource();
  const source = useHighlight(sourceId ?? undefined);

  if (sourceId && !source.data && !source.error) {
    return (
      <LoadingRegion>
        <Skeleton className="h-12 w-96 max-w-full rounded-full" />
        <Skeleton className="h-[36rem] rounded-[1.75rem]" />
      </LoadingRegion>
    );
  }

  return (
    <>
      <PageHeader
        title={source.data ? "Duplicar destaque" : "Novo destaque"}
        description={
          source.data
            ? `Cópia de “${source.data.title}”, com período novo a partir da próxima hora. Entra no fim do carrossel.`
            : "Entra no fim do carrossel; depois é só arrastar para a posição certa."
        }
        back={{ to: PATHS.highlights, label: "Destaques" }}
      />
      <HighlightForm
        copyOf={source.data}
        submitLabel="Criar destaque"
        saving={create.isPending}
        next={next}
        total={total}
        onSubmit={(values, { form, allowLeave }) =>
          create.mutate(cleanHighlight(values), {
            onSuccess: ({ id }) => {
              toast.success(
                values.status === "published" ? "Destaque publicado." : "Rascunho criado.",
              );
              allowLeave();
              navigate(PATHS.highlight(id));
            },
            onError: (e) => {
              if (!applyApiErrors(e, form.setError, HIGHLIGHT_FORM_FIELDS))
                toast.error(errorMessage(e));
            },
          })
        }
      />
    </>
  );
}

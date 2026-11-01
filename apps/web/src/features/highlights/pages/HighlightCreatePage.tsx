import { useNavigate } from "react-router";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { PATHS } from "@/shared/config/paths";
import { PageHeader, toast } from "@/shared/ui";
import { useCreateHighlight, useHighlights } from "../api";
import { HighlightForm } from "../components/form/HighlightForm";
import { carouselContext } from "../lib/carousel";
import { cleanHighlight, HIGHLIGHT_FORM_FIELDS } from "../lib/form";

export function HighlightCreatePage() {
  const navigate = useNavigate();
  const create = useCreateHighlight();
  const all = useHighlights();
  const { next, total } = carouselContext(all.data);

  return (
    <>
      <PageHeader
        title="Novo destaque"
        description="Entra no fim do carrossel; depois é só arrastar para a posição certa."
        back={{ to: PATHS.highlights, label: "Destaques" }}
      />
      <HighlightForm
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

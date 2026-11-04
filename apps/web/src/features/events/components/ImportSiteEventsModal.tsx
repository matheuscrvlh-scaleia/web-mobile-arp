import { useState } from "react";
import { errorMessage } from "@/shared/api";
import { Button, Field, Modal, Select, toast } from "@/shared/ui";
import { useEventCategories, useImportSiteEvents } from "../api";

/** Traz a agenda do site (espacoarp.com.br) como rascunhos, para o gestor revisar e publicar. */
export function ImportSiteEventsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const categories = useEventCategories({ enabled: open });
  const run = useImportSiteEvents();
  const [categoryId, setCategoryId] = useState("");
  const chosen = categoryId || categories.data?.[0]?.id || "";

  const close = () => {
    run.reset();
    onClose();
  };

  const submit = () =>
    run.mutate(
      { categoryId: chosen },
      {
        onSuccess: ({ created, skipped, failed }) => {
          const parts = [
            created === 1 ? "1 evento novo" : `${created} eventos novos`,
            skipped > 0 && `${skipped} já importados antes`,
            failed > 0 && `${failed} sem data legível no site`,
          ].filter(Boolean);
          toast.success(`Importação concluída: ${parts.join(", ")}.`);
          close();
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  return (
    <Modal
      open={open}
      onClose={close}
      busy={run.isPending}
      title="Importar eventos do site"
      description="Traz da agenda de espacoarp.com.br os eventos de hoje em diante que ainda não vieram. Eles entram como rascunho (fora do app): revise e publique um a um. O que já foi importado não é trazido de novo, mesmo se você editar ou apagar aqui."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={run.isPending}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={run.isPending} disabled={!chosen}>
            Importar
          </Button>
        </>
      }
    >
      <Field
        label="Categoria dos eventos importados"
        hint="O site não tem categoria; dá para trocar em cada evento depois."
      >
        <Select value={chosen} onChange={(e) => setCategoryId(e.target.value)}>
          {(categories.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
    </Modal>
  );
}

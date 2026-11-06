import { useState } from "react";
import { plural } from "@/shared/lib/format";
import { ConfirmDialog, Field, Select } from "@/shared/ui";

interface Item {
  id: string;
  name: string;
  storesCount: number;
}

/**
 * Excluir bloco ou categoria. Sem lojas: confirmação simples. Com lojas:
 * escolher para onde elas vão ("Mover para…") e só então excluir, tudo
 * de uma vez (antes era preciso abrir loja por loja).
 */
export function DeleteCatalogModal<T extends Item>({
  item,
  noun,
  options,
  loading,
  error,
  onClose,
  onConfirm,
}: {
  item: T | null;
  /** "categoria" ou "bloco" (texto da janela). */
  noun: "categoria" | "bloco";
  /** Para onde as lojas podem ir (sem o próprio item). */
  options: { id: string; name: string }[];
  loading: boolean;
  error: unknown;
  onClose: () => void;
  onConfirm: (moveTo: string | undefined) => void;
}) {
  const [moveTo, setMoveTo] = useState("");
  const [missing, setMissing] = useState(false);
  const inUse = (item?.storesCount ?? 0) > 0;
  const article = noun === "categoria" ? "a" : "o";
  const close = () => {
    setMoveTo("");
    setMissing(false);
    onClose();
  };

  return (
    <ConfirmDialog
      open={item !== null}
      onClose={close}
      danger
      title={`Excluir ${article} ${noun} ${item?.name ?? ""}?`}
      description={
        inUse
          ? `${item?.name} tem ${plural(item?.storesCount ?? 0, "loja", "lojas")}. Escolha para ${noun === "categoria" ? "qual categoria" : "qual bloco"} elas vão; depois ${article} ${noun} é excluíd${article}.`
          : `${noun === "categoria" ? "Ela some dos filtros do app" : "Ele some das opções de “onde fica”"}. Nenhuma loja usa ${article} ${noun}.`
      }
      confirmLabel={inUse ? "Mover lojas e excluir" : "Excluir"}
      loading={loading}
      error={error}
      onConfirm={() => {
        if (inUse && !moveTo) {
          setMissing(true);
          return;
        }
        onConfirm(inUse ? moveTo : undefined);
      }}
    >
      {inUse && (
        <Field
          label="Mover as lojas para"
          required
          error={missing && !moveTo ? "Escolha para onde vão as lojas" : undefined}
        >
          <Select
            placeholder={noun === "categoria" ? "Escolha a categoria" : "Escolha o bloco"}
            value={moveTo}
            onChange={(e) => setMoveTo(e.target.value)}
          >
            {options
              .filter((o) => o.id !== item?.id)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
          </Select>
        </Field>
      )}
    </ConfirmDialog>
  );
}

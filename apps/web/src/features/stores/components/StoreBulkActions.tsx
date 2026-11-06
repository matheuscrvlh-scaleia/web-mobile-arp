import type { BulkUpdateStoresBody, StoreSummary } from "@arp/contracts";
import { Building2, Layers, PowerOff, Tags, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useBlocks, useStoreCategories } from "@/features/catalog";
import { useFloors } from "@/features/map";
import { errorMessage } from "@/shared/api";
import { plural } from "@/shared/lib/format";
import { Button, Field, Modal, registerBottomBar, Select, toast } from "@/shared/ui";
import { useBulkUpdateStores } from "../api";
import { confirmDeactivate } from "./confirm-deactivate";

type Field_ = "categoryId" | "blockId" | "floorId";
type Changes = BulkUpdateStoresBody["changes"];

const FIELD_LABEL: Record<Field_, { title: string; label: string }> = {
  categoryId: { title: "Mudar categoria", label: "Nova categoria principal" },
  blockId: { title: "Mudar bloco", label: "Novo bloco" },
  floorId: { title: "Mudar andar", label: "Novo andar" },
};

/** Valor atual de cada loja no campo (para o "Desfazer" voltar loja por loja). */
const currentOf = (s: StoreSummary, field: Field_ | "status") =>
  field === "categoryId"
    ? s.category.id
    : field === "blockId"
      ? s.block.id
      : field === "floorId"
        ? s.floor.id
        : s.status;

/**
 * Barra das lojas marcadas na tabela: mudar categoria, bloco ou andar e
 * desativar, tudo de uma vez. Aplica na hora e o aviso tem "Desfazer"
 * (menos trocar de andar, que tira as lojas do mapa).
 */
export function StoreBulkActions({
  selected,
  onClear,
}: {
  selected: StoreSummary[];
  onClear: () => void;
}) {
  const bulk = useBulkUpdateStores();
  // Os avisos sobem acima da barra enquanto ela está na tela.
  useEffect(() => registerBottomBar(), []);
  const [editing, setEditing] = useState<Field_ | null>(null);
  const n = selected.length;
  const label = plural(n, "loja", "lojas");

  /** Aplica e oferece desfazer agrupando as lojas pelo valor que tinham antes. */
  const apply = (field: Field_ | "status", value: string, message: string, undoable = true) => {
    const before = new Map<string, string[]>();
    for (const s of selected) {
      const v = currentOf(s, field);
      if (v === value) continue;
      before.set(v, [...(before.get(v) ?? []), s.id]);
    }
    const ids = [...before.values()].flat();
    if (ids.length === 0) {
      toast.info("Nada mudou: as lojas marcadas já estavam assim.");
      setEditing(null);
      return;
    }
    const undo = () =>
      Promise.all(
        [...before].map(([v, groupIds]) =>
          bulk.mutateAsync({ ids: groupIds, changes: { [field]: v } as Changes }),
        ),
      ).then(
        () => toast.info("Mudança desfeita."),
        (e) => toast.error(errorMessage(e)),
      );
    bulk.mutate(
      { ids, changes: { [field]: value } as Changes },
      {
        onSuccess: ({ updated }) => {
          setEditing(null);
          onClear();
          toast.success(
            `${plural(updated, "loja", "lojas")}: ${message}`,
            undoable ? { action: { label: "Desfazer", onClick: () => void undo() } } : undefined,
          );
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  return (
    <section
      aria-label="Ações nas lojas marcadas"
      className="fume sticky bottom-3 z-20 mt-4 flex flex-wrap items-center gap-2 rounded-[1.5rem] py-2 pr-2 pl-5 md:rounded-full"
    >
      <span className="mr-auto text-sm font-medium text-[#fff]">
        {label} {n === 1 ? "marcada" : "marcadas"}
      </span>
      <Button size="sm" variant="secondary" icon={Tags} onClick={() => setEditing("categoryId")}>
        Categoria
      </Button>
      <Button size="sm" variant="secondary" icon={Building2} onClick={() => setEditing("blockId")}>
        Bloco
      </Button>
      <Button size="sm" variant="secondary" icon={Layers} onClick={() => setEditing("floorId")}>
        Andar
      </Button>
      <Button
        size="sm"
        variant="secondary"
        icon={PowerOff}
        loading={bulk.isPending && !editing}
        onClick={async () => {
          // Só as ativas mudam; com cupom no ar ou muitas de uma vez, pergunta antes.
          const active = selected.filter((s) => s.status === "active");
          if (active.length > 0 && !(await confirmDeactivate(active))) return;
          apply("status", "inactive", "desativadas (saíram do app).");
        }}
      >
        Desativar
      </Button>
      <button
        type="button"
        onClick={onClear}
        aria-label="Desmarcar todas"
        className="grid size-9 cursor-pointer place-items-center rounded-full text-[rgb(255_255_255/0.8)] hover:bg-[rgb(255_255_255/0.1)]"
      >
        <X className="size-4" aria-hidden />
      </button>
      {editing && (
        <BulkFieldModal
          field={editing}
          count={n}
          saving={bulk.isPending}
          onClose={() => setEditing(null)}
          onApply={(value, name) =>
            apply(
              editing,
              value,
              editing === "floorId"
                ? `agora no ${name}. Posicione no mapa do novo andar.`
                : `agora em ${name}.`,
              editing !== "floorId",
            )
          }
        />
      )}
    </section>
  );
}

function BulkFieldModal({
  field,
  count,
  saving,
  onClose,
  onApply,
}: {
  field: Field_;
  count: number;
  saving: boolean;
  onClose: () => void;
  onApply: (value: string, name: string) => void;
}) {
  const categories = useStoreCategories({ enabled: field === "categoryId" });
  const blocks = useBlocks({ enabled: field === "blockId" });
  const floors = useFloors({ enabled: field === "floorId" });
  const [value, setValue] = useState("");
  const options =
    field === "categoryId"
      ? (categories.data ?? []).map((c) => ({ id: c.id, name: c.name }))
      : field === "blockId"
        ? (blocks.data ?? []).map((b) => ({ id: b.id, name: b.name }))
        : (floors.data ?? []).map((f) => ({ id: f.id, name: f.label }));
  const chosen = options.find((o) => o.id === value);

  return (
    <Modal
      open
      onClose={onClose}
      busy={saving}
      size="sm"
      title={`${FIELD_LABEL[field].title} de ${plural(count, "loja", "lojas")}`}
      description={
        field === "floorId"
          ? "Trocar o andar tira as lojas do mapa: depois, posicione cada uma no mapa do novo andar."
          : field === "categoryId"
            ? "A categoria principal muda; as outras categorias de cada loja continuam."
            : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Voltar
          </Button>
          <Button
            disabled={!chosen}
            loading={saving}
            onClick={() => chosen && onApply(chosen.id, chosen.name)}
          >
            Aplicar
          </Button>
        </>
      }
    >
      <Field label={FIELD_LABEL[field].label}>
        <Select placeholder="Escolha" value={value} onChange={(e) => setValue(e.target.value)}>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
      </Field>
    </Modal>
  );
}

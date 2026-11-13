import type { Seal } from "@arp/contracts";
import { Archive, ArchiveRestore, Award, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/shared/auth";
import { cn } from "@/shared/lib/cn";
import { plural } from "@/shared/lib/format";
import { normalize } from "@/shared/lib/text";
import {
  ActionMenu,
  type ActionMenuItems,
  Button,
  Can,
  Card,
  confirmar,
  EmptyState,
  ErrorState,
  SearchInput,
  SkeletonGrid,
  StatusBadge,
  StatusTabs,
  statusTabLabel,
  toast,
} from "@/shared/ui";
import { useDeleteSeal, useSaveSeal, useSeals } from "../api";
import { SealBadge } from "./SealBadge";
import { SealFormModal } from "./SealFormModal";

type Dialog = { kind: "form"; seal?: Seal } | null;

/**
 * Coleção de selos: ativos em cima, arquivados embaixo. O "Novo selo" do
 * cabeçalho da página abre o formulário por `creating`.
 */
export function SealGallery({
  creating,
  onCreate,
  onCreateClose,
}: {
  creating: boolean;
  onCreate: () => void;
  onCreateClose: () => void;
}) {
  const seals = useSeals();
  const save = useSaveSeal();
  const remove = useDeleteSeal();
  const { can } = useAuth();
  const manage = can("challenges.manage");
  const [dialog, setDialog] = useState<Dialog>(null);
  const all = [...(seals.data ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );
  // Filtro padrão (R2G-11): situação com contador + busca pelo nome.
  const [situation, setSituation] = useState<Seal["status"]>("active");
  const [search, setSearch] = useState("");
  const term = normalize(search.trim());
  const shown = all.filter(
    (s) => s.status === situation && (!term || normalize(s.name).includes(term)),
  );
  const countOf = (st: Seal["status"]) => all.filter((s) => s.status === st).length;
  const nextOrder = Math.min(999, Math.max(-1, ...all.map((s) => s.sortOrder)) + 1);

  const close = () => {
    save.reset();
    setDialog(null);
    onCreateClose();
  };
  // Arquivar e desarquivar são reversíveis: na hora, com "Desfazer".
  const setStatus = (seal: Seal, status: Seal["status"], undo = true) =>
    save.mutate(
      { id: seal.id, body: { status } },
      {
        onSuccess: () =>
          toast.success(
            status === "archived"
              ? seal.activeChallengesCount > 0
                ? `${seal.name} arquivado: some da escolha de novos desafios. ${plural(seal.activeChallengesCount, "desafio ativo continua", "desafios ativos continuam")} dando este selo; para parar, pause ${seal.activeChallengesCount === 1 ? "o desafio" : "os desafios"}.`
                : `${seal.name} arquivado: some da escolha de novos desafios.`
              : `${seal.name} voltou para a coleção.`,
            undo
              ? {
                  action: {
                    label: "Desfazer",
                    onClick: () =>
                      setStatus(seal, status === "archived" ? "active" : "archived", false),
                  },
                }
              : undefined,
          ),
        onError: (e) => toast.fromError(e),
      },
    );
  const askDelete = async (seal: Seal) => {
    const ok = await confirmar({
      title: `Excluir o selo ${seal.name}?`,
      description: "Ninguém ganhou este selo e nenhum desafio o usa. Não dá para desfazer.",
      confirmLabel: "Excluir selo",
      danger: true,
    });
    if (!ok) return;
    remove.mutate(seal.id, {
      onSuccess: () => toast.success(`Selo ${seal.name} excluído.`),
      onError: (e) => toast.fromError(e),
    });
  };
  const menuOf = (seal: Seal): ActionMenuItems => {
    const inUse = seal.earnedCount > 0 || seal.challengesCount > 0;
    return [
      { label: "Editar", icon: Pencil, onSelect: () => setDialog({ kind: "form", seal }) },
      seal.status === "archived"
        ? { label: "Desarquivar", icon: ArchiveRestore, onSelect: () => setStatus(seal, "active") }
        : { label: "Arquivar", icon: Archive, onSelect: () => setStatus(seal, "archived") },
      {
        label: "Excluir",
        icon: Trash2,
        danger: true,
        disabled: inUse,
        hint:
          seal.earnedCount > 0
            ? `Já foi conquistado ${plural(seal.earnedCount, "vez", "vezes")}: arquive em vez de excluir.`
            : seal.challengesCount > 0
              ? `${plural(seal.challengesCount, "desafio usa", "desafios usam")} este selo: arquive em vez de excluir.`
              : undefined,
        onSelect: () => void askDelete(seal),
      },
    ];
  };

  if (seals.error)
    return (
      <Card>
        <ErrorState error={seals.error} onRetry={() => void seals.refetch()} />
      </Card>
    );
  if (!seals.data)
    return (
      <SkeletonGrid
        count={8}
        className="grid-cols-2 sm:grid-cols-3 xl:grid-cols-4"
        itemClassName="h-60"
      />
    );

  return (
    <>
      {all.length === 0 ? (
        <Card>
          <EmptyState
            icon={Award}
            title="Nenhum selo ainda"
            description="Crie os selos da coleção; depois, cada desafio dá um deles."
            action={
              <Can permission="challenges.manage">
                <Button icon={Plus} onClick={onCreate}>
                  Nova categoria
                </Button>
              </Can>
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col">
          <div className="flex flex-wrap items-start gap-3">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar selo"
              label="Buscar selo"
              className="mb-5 w-full sm:w-64"
            />
            <StatusTabs
              value={situation}
              onChange={setSituation}
              options={[
                { value: "active", label: statusTabLabel("active"), count: countOf("active") },
                {
                  value: "archived",
                  label: statusTabLabel("archived"),
                  count: countOf("archived"),
                },
              ]}
            />
          </div>
          {situation === "archived" && (
            <p className="mb-3 text-sm text-neutral-500">
              Arquivados ficam fora da escolha de desafios novos.
            </p>
          )}
          {shown.length === 0 ? (
            <Card>
              <EmptyState
                compact
                icon={Award}
                title={term ? "Nenhum selo com essa busca" : "Nenhum selo aqui"}
              />
            </Card>
          ) : (
            <SealGrid
              label={situation === "active" ? "Selos ativos" : "Selos arquivados"}
              seals={shown}
              manage={manage}
              onOpen={(seal) => setDialog({ kind: "form", seal })}
              menuOf={menuOf}
            />
          )}
        </div>
      )}

      {(creating || dialog?.kind === "form") && (
        <SealFormModal
          seal={dialog?.kind === "form" ? dialog.seal : undefined}
          nextOrder={nextOrder}
          readOnly={!manage}
          onClose={close}
        />
      )}
    </>
  );
}

function SealGrid({
  label,
  seals,
  manage,
  onOpen,
  menuOf,
}: {
  label: string;
  seals: Seal[];
  manage: boolean;
  onOpen: (seal: Seal) => void;
  menuOf: (seal: Seal) => ActionMenuItems;
}) {
  if (seals.length === 0)
    return <p className="py-6 text-center text-sm text-neutral-500">Nenhum selo ativo.</p>;
  return (
    <ul
      data-guia="tabela"
      aria-label={label}
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4"
    >
      {seals.map((s) => {
        const archived = s.status === "archived";
        return (
          <li
            key={s.id}
            className={cn(
              "vidro relative flex flex-col items-center gap-3 rounded-[1.75rem] p-5 text-center",
              archived && "opacity-75",
            )}
          >
            <button
              type="button"
              onClick={() => onOpen(s)}
              className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl"
            >
              <SealBadge seal={s} size="lg" locked={archived} />
              <span className="font-semibold text-neutral-900">
                {s.name}
                <span className="sr-only">{manage ? ", editar" : ", ver detalhes"}</span>
              </span>
            </button>
            {s.description && (
              <p className="line-clamp-2 text-xs text-neutral-500">{s.description}</p>
            )}
            <div className="mt-auto flex flex-wrap justify-center gap-1.5">
              {archived ? (
                <StatusBadge tone="neutral" icon={Archive}>
                  Arquivado
                </StatusBadge>
              ) : (
                <StatusBadge tone="brand" icon={Award}>
                  {plural(s.earnedCount, "conquista", "conquistas")}
                </StatusBadge>
              )}
              {s.activeChallengesCount > 0 && (
                <StatusBadge tone="neutral" icon={Target}>
                  {plural(s.activeChallengesCount, "desafio ativo", "desafios ativos")}
                </StatusBadge>
              )}
            </div>
            {manage && (
              <div className="absolute top-2 right-2">
                <ActionMenu items={menuOf(s)} size="sm" ariaLabel={`Mais ações de ${s.name}`} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

import type { Seal } from "@arp/contracts";
import { Archive, ArchiveRestore, Award, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/shared/auth";
import { cn } from "@/shared/lib/cn";
import { plural } from "@/shared/lib/format";
import {
  Button,
  Can,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  SkeletonGrid,
  StatusBadge,
  toast,
} from "@/shared/ui";
import { useSaveSeal, useSeals } from "../api";
import { SealBadge } from "./SealBadge";
import { SealFormModal } from "./SealFormModal";

type Dialog = { kind: "form"; seal?: Seal } | { kind: "archive"; seal: Seal } | null;

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
  const { can } = useAuth();
  const manage = can("challenges.manage");
  const [dialog, setDialog] = useState<Dialog>(null);
  const all = [...(seals.data ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );
  const active = all.filter((s) => s.status === "active");
  const archived = all.filter((s) => s.status === "archived");
  const nextOrder = Math.min(999, Math.max(-1, ...all.map((s) => s.sortOrder)) + 1);

  const close = () => {
    save.reset();
    setDialog(null);
    onCreateClose();
  };
  const restore = (seal: Seal) =>
    save.mutate(
      { id: seal.id, body: { status: "active" } },
      {
        onSuccess: () => toast.success(`${seal.name} voltou para a coleção.`),
        onError: (e) => toast.fromError(e),
      },
    );

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
                  Novo selo
                </Button>
              </Can>
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          <SealGrid
            label="Selos ativos"
            seals={active}
            manage={manage}
            onOpen={(seal) => setDialog({ kind: "form", seal })}
            onArchive={(seal) => setDialog({ kind: "archive", seal })}
            onRestore={restore}
          />
          {archived.length > 0 && (
            <section aria-labelledby="selos-arquivados">
              <h2 id="selos-arquivados" className="mb-3 text-sm font-semibold text-neutral-500">
                Arquivados ({archived.length}) · fora dos desafios novos
              </h2>
              <SealGrid
                label="Selos arquivados"
                seals={archived}
                manage={manage}
                onOpen={(seal) => setDialog({ kind: "form", seal })}
                onArchive={(seal) => setDialog({ kind: "archive", seal })}
                onRestore={restore}
              />
            </section>
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
      <ConfirmDialog
        open={dialog?.kind === "archive"}
        onClose={close}
        title={dialog?.kind === "archive" ? `Arquivar ${dialog.seal.name}?` : "Arquivar selo?"}
        description="Some da escolha de novos desafios. Quem já ganhou continua com o selo."
        confirmLabel="Arquivar"
        loading={save.isPending}
        error={save.error}
        onConfirm={() => {
          if (dialog?.kind !== "archive") return;
          const { seal } = dialog;
          save.mutate(
            { id: seal.id, body: { status: "archived" } },
            {
              onSuccess: () => {
                toast.success(`${seal.name} arquivado.`);
                close();
              },
            },
          );
        }}
      />
    </>
  );
}

function SealGrid({
  label,
  seals,
  manage,
  onOpen,
  onArchive,
  onRestore,
}: {
  label: string;
  seals: Seal[];
  manage: boolean;
  onOpen: (seal: Seal) => void;
  onArchive: (seal: Seal) => void;
  onRestore: (seal: Seal) => void;
}) {
  if (seals.length === 0)
    return <p className="py-6 text-center text-sm text-neutral-500">Nenhum selo ativo.</p>;
  return (
    <ul aria-label={label} className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
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
            </div>
            {manage && (
              <div className="absolute top-2 right-2 flex">
                <IconButton
                  icon={Pencil}
                  size="sm"
                  label={`Editar ${s.name}`}
                  onClick={() => onOpen(s)}
                />
                {archived ? (
                  <IconButton
                    icon={ArchiveRestore}
                    size="sm"
                    label={`Reativar ${s.name}`}
                    onClick={() => onRestore(s)}
                  />
                ) : (
                  <IconButton
                    icon={Archive}
                    size="sm"
                    label={`Arquivar ${s.name}`}
                    onClick={() => onArchive(s)}
                  />
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

import {
  type Block,
  STORE_KIND_LABEL,
  type StoreCategory,
  type StoreKind,
  storeKindSchema,
} from "@arp/contracts";
import { Building2, Plus, Tags } from "lucide-react";
import { useState } from "react";
import { errorMessage } from "@/shared/api";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { useSearchParamOption } from "@/shared/hooks";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  IconTile,
  PageHeader,
  Skeleton,
  type TabItem,
  TabPanel,
  Tabs,
  toast,
} from "@/shared/ui";
import {
  useBlocks,
  useDeleteBlock,
  useDeleteStoreCategory,
  useReorderBlocks,
  useReorderStoreCategories,
  useStoreCategories,
} from "../api";
import { BlockFormModal } from "../components/BlockFormModal";
import { CategoryFormModal } from "../components/CategoryFormModal";
import { DeleteCatalogModal } from "../components/DeleteCatalogModal";
import { SortableCatalogList } from "../components/SortableCatalogList";

type Tab = "categorias" | "blocos";

/** Cor de cada uma das 3 categorias do app. */
const KIND_COLOR: Record<StoreKind, string> = {
  shop: "#2f7d3d",
  food: "#c8692f",
  service: "#3d5a80",
};

/** Lista de lojas já filtrada (o número de lojas de cada item leva para lá). */
const storesWith = (filter: { categoryId?: string; blockId?: string }) =>
  `${PATHS.stores}?${new URLSearchParams(filter as Record<string, string>).toString()}&visao=tabela`;

const byOrder = <T extends { sortOrder: number; name: string }>(a: T, b: T) =>
  a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR");

export function CatalogPage() {
  const { can } = useAuth();
  const tabs: TabItem<Tab>[] = [
    { value: "categorias", label: "Categorias de loja", icon: Tags },
    ...(can("map.view") ? [{ value: "blocos" as const, label: "Blocos", icon: Building2 }] : []),
  ];
  const [tab, setTab] = useSearchParamOption<Tab>("aba", ["categorias", "blocos"], "categorias");
  const current = tabs.some((t) => t.value === tab) ? tab : "categorias";

  return (
    <>
      <PageHeader
        title="Categorias e blocos"
        description="Os cadastros que organizam o guia: categorias das lojas e os blocos da ARP. Arraste ou use as setas para mudar a ordem do app."
      />
      {tabs.length > 1 && (
        <Tabs
          idBase="cadastros"
          label="Cadastros"
          items={tabs}
          value={current}
          onChange={setTab}
          className="mb-5"
        />
      )}
      <TabPanel idBase="cadastros" value={current}>
        {current === "categorias" ? (
          <CategoriesTab canEdit={can("stores.manage")} />
        ) : (
          <BlocksTab canEdit={can("map.manage")} />
        )}
      </TabPanel>
    </>
  );
}

const KINDS = storeKindSchema.options;

/** As 3 categorias do app em abas, cada uma com a largura toda. */
function CategoriesTab({ canEdit }: { canEdit: boolean }) {
  const categories = useStoreCategories();
  const remove = useDeleteStoreCategory();
  const reorder = useReorderStoreCategories();
  const [kind, setKind] = useSearchParamOption<StoreKind>("tipo", KINDS, "shop");
  const [editing, setEditing] = useState<StoreCategory | { kind: StoreKind } | null>(null);
  const [deleting, setDeleting] = useState<StoreCategory | null>(null);

  if (categories.error) {
    return (
      <Card>
        <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />
      </Card>
    );
  }

  const all = categories.data ?? [];
  const rows = all.filter((c) => c.kind === kind).sort(byOrder);
  const kindTabs: TabItem<StoreKind>[] = KINDS.map((k) => ({
    value: k,
    label: `${STORE_KIND_LABEL[k]} (${all.filter((c) => c.kind === k).length})`,
  }));

  return (
    <Card>
      <CardHeader
        title={`Categorias de ${STORE_KIND_LABEL[kind]}`}
        description={`Aparecem nesta ordem na aba “${STORE_KIND_LABEL[kind]}” do app.`}
        action={
          canEdit && (
            <Button size="sm" variant="secondary" icon={Plus} onClick={() => setEditing({ kind })}>
              Nova categoria
            </Button>
          )
        }
      />
      <Tabs
        idBase="tipos"
        label="Tipo de categoria"
        items={kindTabs}
        value={kind}
        onChange={setKind}
        className="mb-4"
      />
      <TabPanel idBase="tipos" value={kind}>
        {categories.isLoading ? (
          <Skeleton className="h-64 rounded-2xl" />
        ) : rows.length === 0 ? (
          <EmptyState compact icon={Tags} title="Nenhuma categoria ainda" />
        ) : (
          <SortableCatalogList
            items={rows}
            label={`Ordem das categorias de ${STORE_KIND_LABEL[kind]}`}
            canEdit={canEdit}
            leading={(c) => <IconTile icon={c.icon} size="sm" color={KIND_COLOR[kind]} />}
            storesHref={(c) => storesWith({ categoryId: c.id })}
            onReorder={(ids) => {
              // Ordem de antes, para o "Desfazer" do aviso.
              const before = rows.map((c) => c.id);
              reorder.mutate(ids, {
                onSuccess: () =>
                  toast.success("Ordem salva. O app já mostra assim.", {
                    action: {
                      label: "Desfazer",
                      onClick: () =>
                        reorder.mutate(before, {
                          onSuccess: () => toast.info("Ordem anterior de volta."),
                          onError: (e) => toast.error(errorMessage(e)),
                        }),
                    },
                  }),
                onError: (e) => toast.error(errorMessage(e)),
              });
            }}
            onEdit={setEditing}
            onDelete={setDeleting}
          />
        )}
      </TabPanel>

      <CategoryFormModal
        open={editing !== null}
        category={editing && "id" in editing ? editing : undefined}
        defaultKind={editing && !("id" in editing) ? editing.kind : undefined}
        nextOrder={rows.length}
        onClose={() => setEditing(null)}
      />
      <DeleteCatalogModal
        item={deleting}
        noun="categoria"
        options={[...all]
          .sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || byOrder(a, b))
          .map((c) => ({ id: c.id, name: `${c.name} (${STORE_KIND_LABEL[c.kind]})` }))}
        loading={remove.isPending}
        error={remove.error}
        onClose={() => {
          setDeleting(null);
          remove.reset();
        }}
        onConfirm={(moveTo) =>
          deleting &&
          remove.mutate(
            { id: deleting.id, ...(moveTo ? { moveTo } : {}) },
            {
              onSuccess: () => {
                toast.success(
                  moveTo ? "Lojas movidas e categoria excluída." : "Categoria excluída.",
                );
                setDeleting(null);
              },
            },
          )
        }
      />
    </Card>
  );
}

function BlocksTab({ canEdit }: { canEdit: boolean }) {
  const blocks = useBlocks();
  const remove = useDeleteBlock();
  const reorder = useReorderBlocks();
  const [editing, setEditing] = useState<Block | "new" | null>(null);
  const [deleting, setDeleting] = useState<Block | null>(null);
  const rows = blocks.data ? [...blocks.data].sort(byOrder) : [];

  return (
    <Card>
      <CardHeader
        title="Blocos"
        description="Os prédios da ARP, usados no “onde fica” de cada loja. A ordem vale para os filtros."
        action={
          canEdit && (
            <Button size="sm" variant="secondary" icon={Plus} onClick={() => setEditing("new")}>
              Novo bloco
            </Button>
          )
        }
      />
      {blocks.error ? (
        <ErrorState compact error={blocks.error} onRetry={() => void blocks.refetch()} />
      ) : blocks.isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : rows.length === 0 ? (
        <EmptyState compact icon={Building2} title="Nenhum bloco ainda" />
      ) : (
        <SortableCatalogList
          items={rows}
          label="Ordem dos blocos"
          canEdit={canEdit}
          leading={() => <IconTile icon={Building2} size="sm" />}
          storesHref={(b) => storesWith({ blockId: b.id })}
          onReorder={(ids) => {
            const before = rows.map((b) => b.id);
            reorder.mutate(ids, {
              onSuccess: () =>
                toast.success("Ordem dos blocos salva.", {
                  action: {
                    label: "Desfazer",
                    onClick: () =>
                      reorder.mutate(before, {
                        onSuccess: () => toast.info("Ordem anterior de volta."),
                        onError: (e) => toast.error(errorMessage(e)),
                      }),
                  },
                }),
              onError: (e) => toast.error(errorMessage(e)),
            });
          }}
          onEdit={setEditing}
          onDelete={setDeleting}
        />
      )}
      <BlockFormModal
        open={editing !== null}
        block={editing === "new" || editing === null ? undefined : editing}
        nextOrder={rows.length}
        onClose={() => setEditing(null)}
      />
      <DeleteCatalogModal
        item={deleting}
        noun="bloco"
        options={rows.map((b) => ({ id: b.id, name: b.name }))}
        loading={remove.isPending}
        error={remove.error}
        onClose={() => {
          setDeleting(null);
          remove.reset();
        }}
        onConfirm={(moveTo) =>
          deleting &&
          remove.mutate(
            { id: deleting.id, ...(moveTo ? { moveTo } : {}) },
            {
              onSuccess: () => {
                toast.success(moveTo ? "Lojas movidas e bloco excluído." : "Bloco excluído.");
                setDeleting(null);
              },
            },
          )
        }
      />
    </Card>
  );
}

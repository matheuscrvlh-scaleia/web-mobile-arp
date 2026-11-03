import {
  type Block,
  STORE_KIND_LABEL,
  type StoreCategory,
  type StoreKind,
  storeKindSchema,
} from "@arp/contracts";
import { Building2, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/shared/auth";
import { useSearchParamOption } from "@/shared/hooks";
import { formatNumber } from "@/shared/lib/format";
import {
  Button,
  Card,
  CardHeader,
  type Column,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  IconTile,
  PageHeader,
  type TabItem,
  Table,
  TabPanel,
  Tabs,
  toast,
} from "@/shared/ui";
import { useBlocks, useDeleteBlock, useDeleteStoreCategory, useStoreCategories } from "../api";
import { BlockFormModal } from "../components/BlockFormModal";
import { CategoryFormModal } from "../components/CategoryFormModal";

type Tab = "categorias" | "blocos";

/** Cor de cada uma das 3 categorias do app. */
const KIND_COLOR: Record<StoreKind, string> = {
  shop: "#2f7d3d",
  food: "#c8692f",
  service: "#3d5a80",
};

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
        description="Os cadastros que organizam o guia: categorias das lojas e os blocos da ARP."
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

function CategoriesTab({ canEdit }: { canEdit: boolean }) {
  const categories = useStoreCategories();
  const remove = useDeleteStoreCategory();
  const [editing, setEditing] = useState<StoreCategory | { kind: StoreKind } | null>(null);
  const [deleting, setDeleting] = useState<StoreCategory | null>(null);

  const columns = (kind: StoreKind): Column<StoreCategory>[] => [
    {
      key: "name",
      header: "Categoria",
      cell: (c) => (
        <span className="flex items-center gap-3">
          <IconTile icon={c.icon} size="sm" color={KIND_COLOR[kind]} />
          <span className="font-medium">{c.name}</span>
        </span>
      ),
    },
    { key: "order", header: "Ordem", numeric: true, cell: (c) => c.sortOrder },
    { key: "stores", header: "Lojas", numeric: true, cell: (c) => formatNumber(c.storesCount) },
    ...(canEdit
      ? [
          {
            key: "actions",
            header: <span className="sr-only">Ações</span>,
            numeric: true,
            cell: (c: StoreCategory) => (
              <span className="inline-flex gap-1">
                <IconButton
                  icon={Pencil}
                  size="sm"
                  label={`Editar ${c.name}`}
                  onClick={() => setEditing(c)}
                />
                <IconButton
                  icon={Trash2}
                  size="sm"
                  variant="danger"
                  label={
                    c.storesCount > 0
                      ? `${c.name} tem lojas: mude-as de categoria antes`
                      : `Apagar ${c.name}`
                  }
                  disabled={c.storesCount > 0}
                  onClick={() => setDeleting(c)}
                />
              </span>
            ),
          },
        ]
      : []),
  ];

  if (categories.error) {
    return (
      <Card>
        <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      {storeKindSchema.options.map((kind) => {
        const rows = categories.data
          ?.filter((c) => c.kind === kind)
          .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR"));
        return (
          <Card key={kind}>
            <CardHeader
              title={STORE_KIND_LABEL[kind]}
              description={`Subcategorias da aba “${STORE_KIND_LABEL[kind]}” no app.`}
              action={
                canEdit && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={Plus}
                    onClick={() => setEditing({ kind })}
                  >
                    Nova
                  </Button>
                )
              }
            />
            <Table
              caption={`Categorias de ${STORE_KIND_LABEL[kind]}`}
              columns={columns(kind)}
              rows={rows}
              rowKey={(c) => c.id}
              loading={categories.isLoading}
              skeletonRows={4}
              empty={<EmptyState compact icon={Tags} title="Nenhuma categoria ainda" />}
            />
          </Card>
        );
      })}

      <CategoryFormModal
        open={editing !== null}
        category={editing && "id" in editing ? editing : undefined}
        defaultKind={editing && !("id" in editing) ? editing.kind : undefined}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => {
          setDeleting(null);
          remove.reset();
        }}
        danger
        title={`Apagar a categoria ${deleting?.name ?? ""}?`}
        description="Ela some dos filtros do app."
        confirmLabel="Apagar"
        loading={remove.isPending}
        error={remove.error}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("Categoria apagada.");
              setDeleting(null);
            },
          })
        }
      />
    </div>
  );
}

function BlocksTab({ canEdit }: { canEdit: boolean }) {
  const blocks = useBlocks();
  const remove = useDeleteBlock();
  const [editing, setEditing] = useState<Block | "new" | null>(null);
  const [deleting, setDeleting] = useState<Block | null>(null);

  const columns: Column<Block>[] = [
    {
      key: "name",
      header: "Bloco",
      cell: (b) => (
        <span className="flex items-center gap-3">
          <IconTile icon={Building2} size="sm" />
          <span className="font-medium">{b.name}</span>
        </span>
      ),
    },
    { key: "order", header: "Ordem", numeric: true, cell: (b) => b.sortOrder },
    { key: "stores", header: "Lojas", numeric: true, cell: (b) => formatNumber(b.storesCount) },
    ...(canEdit
      ? [
          {
            key: "actions",
            header: <span className="sr-only">Ações</span>,
            numeric: true,
            cell: (b: Block) => (
              <span className="inline-flex gap-1">
                <IconButton
                  icon={Pencil}
                  size="sm"
                  label={`Editar ${b.name}`}
                  onClick={() => setEditing(b)}
                />
                <IconButton
                  icon={Trash2}
                  size="sm"
                  variant="danger"
                  label={
                    b.storesCount > 0
                      ? `${b.name} tem lojas: mude-as de bloco antes`
                      : `Apagar ${b.name}`
                  }
                  disabled={b.storesCount > 0}
                  onClick={() => setDeleting(b)}
                />
              </span>
            ),
          },
        ]
      : []),
  ];

  return (
    <Card className="max-w-3xl">
      <CardHeader
        title="Blocos"
        description="Os prédios da ARP, usados no “onde fica” de cada loja."
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
      ) : (
        <Table
          caption="Blocos"
          columns={columns}
          rows={
            blocks.data ? [...blocks.data].sort((a, b) => a.sortOrder - b.sortOrder) : undefined
          }
          rowKey={(b) => b.id}
          loading={blocks.isLoading}
          skeletonRows={4}
          empty={<EmptyState compact icon={Building2} title="Nenhum bloco ainda" />}
        />
      )}
      <BlockFormModal
        open={editing !== null}
        block={editing === "new" || editing === null ? undefined : editing}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => {
          setDeleting(null);
          remove.reset();
        }}
        danger
        title={`Apagar o ${deleting?.name ?? "bloco"}?`}
        confirmLabel="Apagar"
        loading={remove.isPending}
        error={remove.error}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("Bloco apagado.");
              setDeleting(null);
            },
          })
        }
      />
    </Card>
  );
}

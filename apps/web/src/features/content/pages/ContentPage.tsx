import {
  ART_POINT_KIND_LABEL,
  type ArtPoint,
  type ContentPage as ContentPageDto,
  type ContentPageKey,
  type RecyclingItem,
} from "@arp/contracts";
import {
  FileText,
  Map as MapIcon,
  MapPinOff,
  Palette,
  Pencil,
  Plus,
  Recycle,
  SearchX,
  Trash2,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { errorMessage } from "@/shared/api";
import { useAuth } from "@/shared/auth";
import { useSearchParamOption, useUnsavedChangesGuard } from "@/shared/hooks";
import { formatDateTime, formatNumber } from "@/shared/lib/format";
import { normalize } from "@/shared/lib/text";
import {
  ActionMenu,
  Button,
  Card,
  CardHeader,
  type Column,
  ConfirmDialog,
  confirmar,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  ImageUpload,
  Input,
  PageHeader,
  SaveBar,
  SearchInput,
  Segmented,
  Skeleton,
  StatusBadge,
  type TabItem,
  Table,
  TabPanel,
  Tabs,
  Textarea,
  toast,
} from "@/shared/ui";
import {
  useArtPoints,
  useContentPages,
  useDeleteArtPoint,
  useDeleteRecyclingItem,
  useRecyclingItems,
  useUpdateContentPage,
} from "../api";
import { ArtPointFormModal } from "../components/ArtPointFormModal";
import { CircuitMap, type MapPoint, NoMapImage } from "../components/CircuitMap";
import { RecyclingItemFormModal } from "../components/RecyclingItemFormModal";
import { SortableRecycling } from "../components/SortableRecycling";

type Tab = "textos" | "circuito" | "sustentarp";
const TABS: TabItem<Tab>[] = [
  { value: "textos", label: "Textos", icon: FileText },
  { value: "circuito", label: "Circuito Cultural", icon: Palette },
  { value: "sustentarp", label: "Sustentarp", icon: Recycle },
];

/** Conteúdo da ARP (Fase 2): textos, Circuito Cultural e Sustentarp. */
export function ContentPage() {
  const { can } = useAuth();
  const canEdit = can("content.manage");
  const [tab, setTab] = useSearchParamOption<Tab>(
    "aba",
    ["textos", "circuito", "sustentarp"],
    "textos",
  );
  // Trocar de aba desmonta os textos: pergunta antes de perder o que foi digitado.
  const [textsDirty, setTextsDirty] = useState(false);
  const changeTab = async (next: Tab) => {
    if (next === tab) return;
    if (tab === "textos" && textsDirty) {
      const ok = await confirmar({
        title: "Trocar de aba sem salvar?",
        description: "Os textos alterados ainda não foram salvos. Se trocar agora, eles se perdem.",
        confirmLabel: "Descartar e trocar",
        cancelLabel: "Continuar editando",
        danger: true,
      });
      if (!ok) return;
      setTextsDirty(false);
    }
    setTab(next);
  };

  return (
    <>
      <PageHeader
        title="Conteúdo do app"
        description="Textos da ARP, pontos do Circuito Cultural e o que o Sustentarp recebe. O app mostra o que está aqui."
      />
      <Tabs
        idBase="conteudo"
        label="Conteúdo"
        items={TABS}
        value={tab}
        onChange={(t) => void changeTab(t)}
        className="mb-5"
      />
      <TabPanel idBase="conteudo" value={tab}>
        {tab === "textos" ? (
          <PagesTab canEdit={canEdit} onDirtyChange={setTextsDirty} />
        ) : tab === "circuito" ? (
          <ArtPointsTab canEdit={canEdit} />
        ) : (
          <RecyclingTab canEdit={canEdit} />
        )}
      </TabPanel>
    </>
  );
}

/* Textos ------------------------------------------------------------------ */

const PAGE_HINT: Record<ContentPageKey, string> = {
  history: "Aparece depois do cadastro e no menu do perfil.",
  rules: "Aparece depois do cadastro e no menu do perfil, com o PDF para baixar.",
  club_rules: "Link na tela do Clube ARP e no menu do perfil.",
  circuit: "Abertura do Circuito Cultural. A imagem é o mapa do Circuito.",
};

interface Draft {
  title: string;
  body: string;
  fileUrl: string | null;
}
type Drafts = Partial<Record<ContentPageKey, Draft>>;

const draftsOf = (pages: ContentPageDto[]): Drafts =>
  Object.fromEntries(
    pages.map((p) => [p.key, { title: p.title, body: p.body, fileUrl: p.fileUrl }]),
  );

const changed = (p: ContentPageDto, d: Draft | undefined) =>
  Boolean(d) && (d?.title !== p.title || d?.body !== p.body || d?.fileUrl !== p.fileUrl);

function PagesTab({
  canEdit,
  onDirtyChange,
}: {
  canEdit: boolean;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const pages = useContentPages();
  if (pages.error) return <ErrorState error={pages.error} onRetry={() => void pages.refetch()} />;
  if (!pages.data) return <Skeleton className="h-64" />;
  return <PagesForm pages={pages.data} canEdit={canEdit} onDirtyChange={onDirtyChange} />;
}

/**
 * Os quatro textos num formulário só: uma barra de salvar para a aba, selo
 * "Não salvo" no cartão alterado, erro no campo e aviso ao sair da tela.
 */
function PagesForm({
  pages,
  canEdit,
  onDirtyChange,
}: {
  pages: ContentPageDto[];
  canEdit: boolean;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const save = useUpdateContentPage();
  const [drafts, setDrafts] = useState<Drafts>(() => draftsOf(pages));
  const [errors, setErrors] = useState<Partial<Record<ContentPageKey, string>>>({});
  const [saving, setSaving] = useState(false);
  const dirtyKeys = pages.filter((p) => changed(p, drafts[p.key])).map((p) => p.key);
  const dirty = dirtyKeys.length > 0;
  useUnsavedChangesGuard(dirty && !saving);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const setDraft = (key: ContentPageKey, patch: Partial<Draft>) => {
    setDrafts((d) => ({ ...d, [key]: { ...(d[key] as Draft), ...patch } }));
    if (patch.title !== undefined) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const missing = Object.fromEntries(
      dirtyKeys.filter((k) => !drafts[k]?.title.trim()).map((k) => [k, "Escreva o título"]),
    );
    setErrors(missing);
    if (Object.keys(missing).length > 0) {
      document
        .querySelector<HTMLInputElement>(`[name="titulo-${Object.keys(missing)[0]}"]`)
        ?.focus();
      return;
    }
    setSaving(true);
    try {
      for (const key of dirtyKeys) {
        const page = pages.find((p) => p.key === key);
        const d = drafts[key];
        if (!page || !d) continue;
        await save.mutateAsync({
          key,
          body: {
            ...(d.title !== page.title ? { title: d.title } : {}),
            ...(d.body !== page.body ? { body: d.body } : {}),
            ...(d.fileUrl !== page.fileUrl ? { fileUrl: d.fileUrl || null } : {}),
          },
        });
      }
      toast.success(dirtyKeys.length > 1 ? "Textos salvos." : "Texto salvo.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} noValidate>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {pages.map((p) => {
          const d = drafts[p.key] ?? { title: p.title, body: p.body, fileUrl: p.fileUrl };
          return (
            <Card key={p.key}>
              <CardHeader
                title={p.title}
                description={`${PAGE_HINT[p.key]}${p.updatedAt ? ` Editado em ${formatDateTime(p.updatedAt)}.` : ""}`}
                action={
                  dirtyKeys.includes(p.key) && (
                    <StatusBadge tone="warning" icon={Pencil}>
                      Não salvo
                    </StatusBadge>
                  )
                }
              />
              <fieldset disabled={!canEdit || saving} className="flex min-w-0 flex-col gap-4">
                <Field label="Título" required error={errors[p.key]}>
                  <Input
                    name={`titulo-${p.key}`}
                    value={d.title}
                    maxLength={120}
                    onChange={(e) => setDraft(p.key, { title: e.target.value })}
                  />
                </Field>
                <Field
                  label="Texto"
                  hint="Separe os parágrafos com uma linha em branco."
                  action={`${formatNumber(d.body.length)} letras`}
                >
                  <Textarea
                    rows={10}
                    value={d.body}
                    onChange={(e) => setDraft(p.key, { body: e.target.value })}
                  />
                </Field>
                {p.key === "rules" ? (
                  <Field
                    label="Link do PDF"
                    optional
                    hint="O botão “Baixar” do app abre este link."
                  >
                    <Input
                      type="url"
                      placeholder="https://"
                      value={d.fileUrl ?? ""}
                      onChange={(e) => setDraft(p.key, { fileUrl: e.target.value || null })}
                    />
                  </Field>
                ) : p.key === "circuit" ? (
                  <Field label="Mapa do Circuito" optional>
                    <ImageUpload
                      label="mapa do Circuito"
                      value={d.fileUrl}
                      onChange={(v) => setDraft(p.key, { fileUrl: v })}
                    />
                  </Field>
                ) : null}
              </fieldset>
            </Card>
          );
        })}
      </div>
      {canEdit && (
        <SaveBar
          dirty={dirty}
          saving={saving}
          onReset={() => {
            setDrafts(draftsOf(pages));
            setErrors({});
          }}
          submitLabel={dirtyKeys.length > 1 ? `Salvar ${dirtyKeys.length} textos` : "Salvar texto"}
        />
      )}
    </form>
  );
}

/* Circuito Cultural ------------------------------------------------------- */

type PlaceFilter = "all" | "missing" | "placed";

function ArtPointsTab({ canEdit }: { canEdit: boolean }) {
  const points = useArtPoints();
  const pages = useContentPages();
  const remove = useDeleteArtPoint();
  const [editing, setEditing] = useState<ArtPoint | "new" | null>(null);
  const [deleting, setDeleting] = useState<ArtPoint | null>(null);
  const [search, setSearch] = useState("");
  const [place, setPlace] = useState<PlaceFilter>("all");
  const [showMap, setShowMap] = useState(false);
  const all = points.data ?? [];
  const nextNumber = Math.max(0, ...all.map((p) => p.number)) + 1;
  const mapUrl = pages.data?.find((p) => p.key === "circuit")?.fileUrl ?? null;
  const missing = all.filter((p) => p.mapX === null || p.mapY === null).length;

  const placed = useMemo<MapPoint[]>(
    () =>
      all.flatMap((p) =>
        p.mapX !== null && p.mapY !== null
          ? [{ id: p.id, number: p.number, name: p.name, x: p.mapX, y: p.mapY }]
          : [],
      ),
    [all],
  );

  const rows = useMemo(() => {
    const q = normalize(search.trim());
    return all.filter((p) => {
      const hasPos = p.mapX !== null && p.mapY !== null;
      if (place === "missing" && hasPos) return false;
      if (place === "placed" && !hasPos) return false;
      return !q || normalize(`${p.number} ${p.name} ${p.artist} ${p.place}`).includes(q);
    });
  }, [all, search, place]);

  const editingPoint = editing === "new" || editing === null ? undefined : editing;
  const columns: Column<ArtPoint>[] = [
    { key: "number", header: "Nº", numeric: true, cell: (p) => p.number, hideOnMobile: true },
    {
      key: "name",
      header: "Ponto",
      primary: true,
      cell: (p) => (
        <span className="flex min-w-0 flex-col">
          <span className="font-medium">
            <span className="text-neutral-400 md:hidden">{p.number}. </span>
            {p.name}
          </span>
          <span className="text-xs text-neutral-500">
            {[p.artist, p.place].filter(Boolean).join(" · ")}
          </span>
        </span>
      ),
    },
    { key: "kind", header: "Tipo", cell: (p) => ART_POINT_KIND_LABEL[p.kind] },
    {
      key: "map",
      header: "Posição",
      cell: (p) =>
        p.mapX === null ? (
          <StatusBadge tone="warning" icon={MapPinOff}>
            Sem posição
          </StatusBadge>
        ) : (
          <span className="text-neutral-600">No mapa</span>
        ),
    },
    {
      key: "status",
      header: "App",
      status: true,
      cell: (p) => (
        <StatusBadge tone={p.active ? "success" : "neutral"}>
          {p.active ? "Visível" : "Oculto"}
        </StatusBadge>
      ),
    },
    ...(canEdit
      ? [
          {
            key: "actions",
            header: <span className="sr-only">Ações</span>,
            numeric: true,
            actions: true,
            cell: (p: ArtPoint) => (
              <ActionMenu
                size="sm"
                ariaLabel={`Mais ações de ${p.name}`}
                items={[
                  { label: "Editar", icon: Pencil, onSelect: () => setEditing(p) },
                  { label: "Excluir", icon: Trash2, danger: true, onSelect: () => setDeleting(p) },
                ]}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <Card>
      <CardHeader
        title="Pontos do Circuito Cultural"
        description="Obras, memórias, esculturas e murais. Clique num ponto para editar e posicionar no mapa."
        action={
          <>
            <Button
              size="sm"
              variant="secondary"
              icon={MapIcon}
              aria-pressed={showMap}
              onClick={() => setShowMap((v) => !v)}
            >
              {showMap ? "Esconder mapa" : "Ver no mapa"}
            </Button>
            {canEdit && (
              <Button
                data-guia="criar"
                size="sm"
                variant="secondary"
                icon={Plus}
                onClick={() => setEditing("new")}
              >
                Novo ponto
              </Button>
            )}
          </>
        }
      />
      {canEdit && pages.data && !mapUrl && !showMap && (
        <div className="mb-5">
          <NoMapImage />
        </div>
      )}
      {showMap && (
        <div className="mb-5">
          {mapUrl ? (
            <CircuitMap
              imageUrl={mapUrl}
              points={placed}
              onPointClick={(id) => {
                const p = all.find((x) => x.id === id);
                if (p && canEdit) setEditing(p);
              }}
              className="max-h-[36rem] overflow-auto"
            />
          ) : (
            <NoMapImage canEdit={canEdit} />
          )}
        </div>
      )}
      <FilterBar className="mb-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nome, artista ou local"
          label="Buscar ponto"
          className="w-full sm:w-72"
        />
        <Segmented
          label="Posição no mapa"
          size="sm"
          value={place}
          onChange={setPlace}
          options={[
            { value: "all", label: `Todos (${formatNumber(all.length)})` },
            { value: "missing", label: `Sem posição (${formatNumber(missing)})` },
            { value: "placed", label: "No mapa" },
          ]}
        />
      </FilterBar>
      {points.error ? (
        <ErrorState compact error={points.error} onRetry={() => void points.refetch()} />
      ) : (
        <Table
          caption="Pontos do Circuito Cultural"
          columns={columns}
          rows={points.data ? rows : undefined}
          rowKey={(p) => p.id}
          onRowClick={canEdit ? (p) => setEditing(p) : undefined}
          rowLabel={(p) => `Editar ${p.name}`}
          mobile="cards"
          loading={points.isLoading}
          skeletonRows={6}
          empty={
            all.length > 0 ? (
              <EmptyState compact icon={SearchX} title="Nenhum ponto com esse filtro" />
            ) : (
              <EmptyState compact icon={Palette} title="Nenhum ponto ainda" />
            )
          }
        />
      )}
      <ArtPointFormModal
        open={editing !== null}
        point={editingPoint}
        nextNumber={nextNumber}
        mapUrl={mapUrl}
        others={placed.filter((p) => p.id !== editingPoint?.id)}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => {
          setDeleting(null);
          remove.reset();
        }}
        danger
        title={`Excluir “${deleting?.name ?? "o ponto"}”?`}
        description="Sai do mapa e da lista do Circuito no app. Para só esconder, desligue “Aparece no app”."
        confirmLabel="Excluir ponto"
        loading={remove.isPending}
        error={remove.error}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("Ponto excluído.");
              setDeleting(null);
            },
          })
        }
      />
    </Card>
  );
}

/* Sustentarp -------------------------------------------------------------- */

function RecyclingTab({ canEdit }: { canEdit: boolean }) {
  const items = useRecyclingItems();
  const remove = useDeleteRecyclingItem();
  const [editing, setEditing] = useState<RecyclingItem | "new" | null>(null);
  const [deleting, setDeleting] = useState<RecyclingItem | null>(null);
  const list = items.data ?? [];
  const nextOrder = Math.max(0, ...list.map((i) => i.sortOrder)) + 1;

  return (
    <Card>
      <CardHeader
        title="O que o Sustentarp recebe"
        description={
          canEdit
            ? "Na ordem do app: arraste pela alça (ou use as setas) para mudar. Salva sozinho."
            : "Na ordem em que aparece no app."
        }
        action={
          canEdit && (
            <Button
              data-guia="criar"
              size="sm"
              variant="secondary"
              icon={Plus}
              onClick={() => setEditing("new")}
            >
              Novo item
            </Button>
          )
        }
      />
      {items.error ? (
        <ErrorState compact error={items.error} onRetry={() => void items.refetch()} />
      ) : !items.data ? (
        <Skeleton className="h-64" />
      ) : list.length === 0 ? (
        <EmptyState compact icon={Recycle} title="Nenhum item ainda" />
      ) : (
        <SortableRecycling
          items={list}
          canEdit={canEdit}
          onEdit={setEditing}
          onDelete={setDeleting}
        />
      )}
      <RecyclingItemFormModal
        open={editing !== null}
        item={editing === "new" || editing === null ? undefined : editing}
        nextOrder={nextOrder}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => {
          setDeleting(null);
          remove.reset();
        }}
        danger
        title={`Excluir “${deleting?.name ?? "o item"}”?`}
        description="Sai da lista do Sustentarp no app. Para só esconder, desligue “Aparece no app”."
        confirmLabel="Excluir item"
        loading={remove.isPending}
        error={remove.error}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("Item excluído.");
              setDeleting(null);
            },
          })
        }
      />
    </Card>
  );
}

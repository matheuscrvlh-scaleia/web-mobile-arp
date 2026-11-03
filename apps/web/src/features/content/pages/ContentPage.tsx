import {
  ART_POINT_KIND_LABEL,
  type ArtPoint,
  type ContentPage as ContentPageDto,
  type RecyclingItem,
} from "@arp/contracts";
import { FileText, Palette, Pencil, Plus, Recycle, Trash2 } from "lucide-react";
import { useState } from "react";
import { errorMessage } from "@/shared/api";
import { useAuth } from "@/shared/auth";
import { useSearchParamOption } from "@/shared/hooks";
import { formatDateTime } from "@/shared/lib/format";
import {
  Button,
  Card,
  CardHeader,
  type Column,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  IconTile,
  ImageUpload,
  Input,
  PageHeader,
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
import { RecyclingItemFormModal } from "../components/RecyclingItemFormModal";

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

  return (
    <>
      <PageHeader
        title="Conteúdo"
        description="Textos da ARP, pontos do Circuito Cultural e o que o Sustentarp recebe. O app mostra o que está aqui."
      />
      <Tabs
        idBase="conteudo"
        label="Conteúdo"
        items={TABS}
        value={tab}
        onChange={setTab}
        className="mb-5"
      />
      <TabPanel idBase="conteudo" value={tab}>
        {tab === "textos" ? (
          <PagesTab canEdit={canEdit} />
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

const PAGE_HINT: Record<ContentPageDto["key"], string> = {
  history: "Aparece depois do cadastro e no menu do perfil.",
  rules: "Aparece depois do cadastro e no menu do perfil, com o PDF para baixar.",
  club_rules: "Link na tela do Clube ARP e no menu do perfil.",
  circuit: "Abertura do Circuito Cultural. A imagem é o mapa do Circuito.",
};

function PagesTab({ canEdit }: { canEdit: boolean }) {
  const pages = useContentPages();
  if (pages.error) return <ErrorState error={pages.error} onRetry={() => void pages.refetch()} />;
  if (!pages.data) return <Skeleton className="h-64" />;
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      {pages.data.map((p) => (
        <PageEditor key={p.key} page={p} canEdit={canEdit} />
      ))}
    </div>
  );
}

function PageEditor({ page, canEdit }: { page: ContentPageDto; canEdit: boolean }) {
  const save = useUpdateContentPage();
  const [title, setTitle] = useState(page.title);
  const [body, setBody] = useState(page.body);
  const [fileUrl, setFileUrl] = useState(page.fileUrl);
  const dirty = title !== page.title || body !== page.body || fileUrl !== page.fileUrl;

  const submit = () =>
    save.mutate(
      {
        key: page.key,
        body: {
          ...(title !== page.title ? { title } : {}),
          ...(body !== page.body ? { body } : {}),
          ...(fileUrl !== page.fileUrl ? { fileUrl: fileUrl || null } : {}),
        },
      },
      {
        onSuccess: () => toast.success(`${title} salvo.`),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  return (
    <Card>
      <CardHeader
        title={page.title}
        description={`${PAGE_HINT[page.key]}${page.updatedAt ? ` Editado em ${formatDateTime(page.updatedAt)}.` : ""}`}
        action={
          canEdit && (
            <Button size="sm" onClick={submit} disabled={!dirty} loading={save.isPending}>
              Salvar
            </Button>
          )
        }
      />
      <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-4">
        <Field label="Título" required>
          <Input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Texto" hint="Separe os parágrafos com uma linha em branco.">
          <Textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        {page.key === "rules" ? (
          <Field label="Link do PDF" optional hint="O botão “Baixar” do app abre este link.">
            <Input
              type="url"
              placeholder="https://"
              value={fileUrl ?? ""}
              onChange={(e) => setFileUrl(e.target.value || null)}
            />
          </Field>
        ) : page.key === "circuit" ? (
          <Field label="Mapa do Circuito" optional>
            <ImageUpload label="mapa do Circuito" value={fileUrl} onChange={setFileUrl} />
          </Field>
        ) : null}
      </fieldset>
    </Card>
  );
}

/* Circuito Cultural ------------------------------------------------------- */

function ArtPointsTab({ canEdit }: { canEdit: boolean }) {
  const points = useArtPoints();
  const remove = useDeleteArtPoint();
  const [editing, setEditing] = useState<ArtPoint | "new" | null>(null);
  const [deleting, setDeleting] = useState<ArtPoint | null>(null);
  const nextNumber = Math.max(0, ...(points.data ?? []).map((p) => p.number)) + 1;

  const columns: Column<ArtPoint>[] = [
    { key: "number", header: "Nº", numeric: true, cell: (p) => p.number },
    {
      key: "name",
      header: "Ponto",
      cell: (p) => (
        <span className="flex flex-col">
          <span className="font-medium">{p.name}</span>
          <span className="text-xs text-neutral-500">
            {[p.artist, p.place].filter(Boolean).join(" · ")}
          </span>
        </span>
      ),
    },
    { key: "kind", header: "Tipo", cell: (p) => ART_POINT_KIND_LABEL[p.kind] },
    {
      key: "map",
      header: "No mapa",
      cell: (p) => (p.mapX === null ? "Sem posição" : `${p.mapX}% · ${p.mapY}%`),
    },
    {
      key: "status",
      header: "App",
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
            cell: (p: ArtPoint) => (
              <span className="inline-flex gap-1">
                <IconButton
                  icon={Pencil}
                  size="sm"
                  label={`Editar ${p.name}`}
                  onClick={() => setEditing(p)}
                />
                <IconButton
                  icon={Trash2}
                  size="sm"
                  variant="danger"
                  label={`Apagar ${p.name}`}
                  onClick={() => setDeleting(p)}
                />
              </span>
            ),
          },
        ]
      : []),
  ];

  return (
    <Card>
      <CardHeader
        title="Pontos do Circuito Cultural"
        description="Obras, memórias, esculturas e murais. Sem rota nem navegação nesta fase."
        action={
          canEdit && (
            <Button size="sm" variant="secondary" icon={Plus} onClick={() => setEditing("new")}>
              Novo ponto
            </Button>
          )
        }
      />
      {points.error ? (
        <ErrorState compact error={points.error} onRetry={() => void points.refetch()} />
      ) : (
        <Table
          caption="Pontos do Circuito Cultural"
          columns={columns}
          rows={points.data}
          rowKey={(p) => p.id}
          loading={points.isLoading}
          skeletonRows={6}
          empty={<EmptyState compact icon={Palette} title="Nenhum ponto ainda" />}
        />
      )}
      <ArtPointFormModal
        open={editing !== null}
        point={editing === "new" || editing === null ? undefined : editing}
        nextNumber={nextNumber}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => {
          setDeleting(null);
          remove.reset();
        }}
        danger
        title={`Apagar ${deleting?.name ?? "o ponto"}?`}
        confirmLabel="Apagar"
        loading={remove.isPending}
        error={remove.error}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("Ponto apagado.");
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

  const columns: Column<RecyclingItem>[] = [
    {
      key: "name",
      header: "Item",
      cell: (i) => (
        <span className="flex items-center gap-3">
          <IconTile icon={i.icon} size="sm" color="#2f7d3d" />
          <span className="flex flex-col">
            <span className="font-medium">{i.name}</span>
            <span className="line-clamp-1 text-xs text-neutral-500">{i.accepts}</span>
          </span>
        </span>
      ),
    },
    { key: "seal", header: "Selo", cell: (i) => (i.givesSeal ? "Vale selo" : "—") },
    {
      key: "status",
      header: "App",
      cell: (i) => (
        <StatusBadge tone={i.active ? "success" : "neutral"}>
          {i.active ? "Visível" : "Oculto"}
        </StatusBadge>
      ),
    },
    { key: "order", header: "Ordem", numeric: true, cell: (i) => i.sortOrder },
    ...(canEdit
      ? [
          {
            key: "actions",
            header: <span className="sr-only">Ações</span>,
            numeric: true,
            cell: (i: RecyclingItem) => (
              <span className="inline-flex gap-1">
                <IconButton
                  icon={Pencil}
                  size="sm"
                  label={`Editar ${i.name}`}
                  onClick={() => setEditing(i)}
                />
                <IconButton
                  icon={Trash2}
                  size="sm"
                  variant="danger"
                  label={`Apagar ${i.name}`}
                  onClick={() => setDeleting(i)}
                />
              </span>
            ),
          },
        ]
      : []),
  ];

  return (
    <Card className="max-w-4xl">
      <CardHeader
        title="O que o Sustentarp recebe"
        description="Lista que muda muito: edite aqui e o app atualiza na hora."
        action={
          canEdit && (
            <Button size="sm" variant="secondary" icon={Plus} onClick={() => setEditing("new")}>
              Novo item
            </Button>
          )
        }
      />
      {items.error ? (
        <ErrorState compact error={items.error} onRetry={() => void items.refetch()} />
      ) : (
        <Table
          caption="Itens do Sustentarp"
          columns={columns}
          rows={items.data}
          rowKey={(i) => i.id}
          loading={items.isLoading}
          skeletonRows={5}
          empty={<EmptyState compact icon={Recycle} title="Nenhum item ainda" />}
        />
      )}
      <RecyclingItemFormModal
        open={editing !== null}
        item={editing === "new" || editing === null ? undefined : editing}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => {
          setDeleting(null);
          remove.reset();
        }}
        danger
        title={`Apagar ${deleting?.name ?? "o item"}?`}
        confirmLabel="Apagar"
        loading={remove.isPending}
        error={remove.error}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("Item apagado.");
              setDeleting(null);
            },
          })
        }
      />
    </Card>
  );
}

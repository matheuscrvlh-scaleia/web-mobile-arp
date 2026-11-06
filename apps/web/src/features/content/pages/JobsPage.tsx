import { createJobBodySchema, JOB_DEFAULT_DAYS, type Job } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { BriefcaseBusiness, CircleStop, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { StoreSelect, useStore } from "@/features/stores";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { useAuth } from "@/shared/auth";
import { formatDate, formatRelative } from "@/shared/lib/format";
import { pickDirty } from "@/shared/lib/forms";
import { normalize } from "@/shared/lib/text";
import {
  ActionMenu,
  Button,
  Card,
  CardHeader,
  type Column,
  confirmar,
  EmptyState,
  ErrorState,
  Field,
  ImageUpload,
  Input,
  LifecycleBadge,
  Modal,
  PageHeader,
  SearchInput,
  StatusTabs,
  statusTabLabel,
  Table,
  Textarea,
  toast,
} from "@/shared/ui";
import { useCloseJob, useJobs, useRemoveJob, useRepublishJob, useSaveJob } from "../api";

type Status = "live" | "expired";

/** "5522999990000" → "(22) 99999-0000" (o que a pessoa reconhece). */
function formatWhatsapp(raw: string | null | undefined): string {
  let d = (raw ?? "").replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length < 3) return d;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2, 11);
  const cut = rest.length > 8 ? 5 : 4;
  return rest.length > cut
    ? `(${ddd}) ${rest.slice(0, cut)}-${rest.slice(cut)}`
    : `(${ddd}) ${rest}`;
}

/** Vagas de emprego das lojas (Fase 2). Saem do app sozinhas no prazo. */
export function JobsPage() {
  const { can, user } = useAuth();
  const canEdit = can("jobs.manage");
  const ownStore = user?.store ?? null;
  const [status, setStatus] = useState<Status>("live");
  const jobs = useJobs({ status });
  const [search, setSearch] = useState("");
  const term = normalize(search.trim());
  const rows = term
    ? jobs.data?.filter((j) => normalize(`${j.title} ${j.store.name}`).includes(term))
    : jobs.data;
  const close = useCloseJob();
  const republish = useRepublishJob();
  const remove = useRemoveJob();
  const [editing, setEditing] = useState<Job | "new" | null>(null);

  const onClose = async (j: Job) => {
    const ok = await confirmar({
      title: `Encerrar a vaga ${j.title}?`,
      description: `A vaga da ${j.store.name} sai do app agora e vai para “Encerradas”. Dá para republicar depois.`,
      confirmLabel: "Encerrar vaga",
      cancelLabel: "Manter no ar",
    });
    if (!ok) return;
    close.mutate(j.id, {
      onSuccess: () =>
        toast.success("Vaga encerrada. Ela está em “Encerradas”.", {
          action: {
            label: "Desfazer",
            onClick: () =>
              republish.mutate(
                { id: j.id, days: daysLeft(j) },
                {
                  onSuccess: () => toast.info("Vaga de volta ao ar."),
                  onError: (e) => toast.error(errorMessage(e)),
                },
              ),
          },
        }),
      onError: (e) => toast.error(errorMessage(e)),
    });
  };

  const onRepublish = (j: Job) =>
    republish.mutate(
      { id: j.id, days: JOB_DEFAULT_DAYS },
      {
        onSuccess: () =>
          toast.success(`Vaga no ar de novo por ${JOB_DEFAULT_DAYS} dias.`, {
            action: {
              label: "Desfazer",
              onClick: () =>
                close.mutate(j.id, {
                  onSuccess: () => toast.info("Vaga encerrada de novo."),
                  onError: (e) => toast.error(errorMessage(e)),
                }),
            },
          }),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  const onDelete = async (j: Job) => {
    const ok = await confirmar({
      title: `Excluir a vaga ${j.title}?`,
      description: "Ela some de vez, também de “Encerradas”. Não dá para desfazer.",
      confirmLabel: "Excluir vaga",
      danger: true,
    });
    if (!ok) return;
    remove.mutate(j.id, {
      onSuccess: () => toast.success("Vaga excluída."),
      onError: (e) => toast.error(errorMessage(e)),
    });
  };

  const columns: Column<Job>[] = [
    {
      key: "title",
      header: "Vaga",
      primary: true,
      cell: (j) => (
        <span className="flex flex-col">
          <span className="font-medium">{j.title}</span>
          <span className="text-xs text-neutral-500">{j.store.name}</span>
        </span>
      ),
    },
    {
      key: "published",
      header: "Publicada",
      cell: (j) => formatDate(j.publishedAt),
      hideOnMobile: true,
    },
    {
      key: "expires",
      // Em "Encerradas" a data já passou.
      header: status === "live" ? "Sai do ar" : "Saiu do ar",
      status: true,
      cell: (j) =>
        j.isLive ? (
          <LifecycleBadge
            status="active"
            label="Ativa"
            hint={`sai ${formatRelative(j.expiresAt)}`}
          />
        ) : (
          <LifecycleBadge status="ended" label="Encerrada" hint={formatDate(j.expiresAt)} />
        ),
    },
    ...(canEdit
      ? [
          {
            key: "actions",
            header: <span className="sr-only">Ações</span>,
            numeric: true,
            actions: true,
            cell: (j: Job) => (
              <span className="inline-flex items-center gap-1">
                {!j.isLive && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={RotateCcw}
                    loading={republish.isPending && republish.variables?.id === j.id}
                    onClick={() => onRepublish(j)}
                  >
                    Republicar por {JOB_DEFAULT_DAYS} dias
                  </Button>
                )}
                <ActionMenu
                  size="sm"
                  ariaLabel={`Mais ações da vaga ${j.title}`}
                  items={[
                    { label: "Editar", icon: Pencil, onSelect: () => setEditing(j) },
                    j.isLive && {
                      label: "Encerrar agora",
                      icon: CircleStop,
                      onSelect: () => void onClose(j),
                    },
                    {
                      label: "Excluir",
                      icon: Trash2,
                      danger: true,
                      onSelect: () => void onDelete(j),
                    },
                  ]}
                />
              </span>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Vagas"
        description="Vagas de emprego das lojas. Ficam no menu do app e saem do ar sozinhas no prazo (padrão: 30 dias)."
        actions={
          canEdit && (
            <Button icon={Plus} onClick={() => setEditing("new")}>
              Publicar vaga
            </Button>
          )
        }
      />
      <Card>
        <CardHeader
          title={status === "live" ? "Ativas" : "Encerradas"}
          description={
            status === "live"
              ? "Clique numa vaga para editar."
              : "Saíram do ar (no prazo ou encerradas). Republique para voltar ao app."
          }
        />
        {/* Filtro padrão (R2G-11) + busca por cargo ou loja. */}
        <div className="flex flex-wrap items-start gap-3 px-1 pt-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar vaga ou loja"
            label="Buscar vaga"
            className="w-full sm:w-64"
          />
          <StatusTabs
            value={status}
            onChange={setStatus}
            className="mb-0"
            options={[
              { value: "live", label: statusTabLabel("active", "a") },
              { value: "expired", label: statusTabLabel("ended", "a") },
            ]}
          />
        </div>
        {jobs.error ? (
          <ErrorState compact error={jobs.error} onRetry={() => void jobs.refetch()} />
        ) : (
          <Table
            caption="Vagas"
            columns={columns}
            rows={rows}
            rowKey={(j) => j.id}
            loading={jobs.isLoading}
            skeletonRows={4}
            mobile="cards"
            onRowClick={canEdit ? (j) => setEditing(j) : undefined}
            empty={
              <EmptyState
                compact
                icon={BriefcaseBusiness}
                title={
                  term
                    ? "Nenhuma vaga com essa busca"
                    : status === "live"
                      ? "Nenhuma vaga ativa"
                      : "Nenhuma vaga encerrada"
                }
              />
            }
          />
        )}
      </Card>
      <JobFormModal
        open={editing !== null}
        job={editing === "new" || editing === null ? undefined : editing}
        storeId={ownStore?.id ?? null}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

type Input_ = z.input<typeof createJobBodySchema>;
type Values = z.output<typeof createJobBodySchema>;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Dias que faltam (vaga no ar) ou o padrão (nova ou encerrada). */
function daysLeft(job: Job | undefined): number {
  if (!job?.isLive) return JOB_DEFAULT_DAYS;
  const left = Math.ceil((new Date(job.expiresAt).getTime() - Date.now()) / DAY_MS);
  return Math.min(90, Math.max(1, left));
}

/**
 * Publicar ou editar vaga, na ordem de quem preenche: loja, cargo,
 * WhatsApp (já vem o da loja), texto ou imagem e prazo. Lojista: a loja
 * dele já vem marcada. A loja não muda na edição.
 */
function JobFormModal({
  open,
  job,
  storeId,
  onClose,
}: {
  open: boolean;
  job?: Job;
  storeId: string | null;
  onClose: () => void;
}) {
  const save = useSaveJob();
  const form = useForm<Input_, unknown, Values>({
    resolver: zodResolver(createJobBodySchema),
    values: job
      ? {
          storeId: job.store.id,
          title: job.title,
          text: job.text,
          imageUrl: job.imageUrl,
          whatsapp: formatWhatsapp(job.whatsapp),
          days: daysLeft(job),
        }
      : {
          storeId: storeId ?? "",
          title: "",
          text: "",
          imageUrl: null,
          whatsapp: "",
          days: JOB_DEFAULT_DAYS,
        },
  });
  const { errors, dirtyFields } = form.formState;
  const [days, chosenStore] = useWatch({ control: form.control, name: ["days", "storeId"] });

  // Loja escolhida (nova vaga): o WhatsApp da loja já entra, se a pessoa não digitou outro.
  const store = useStore(!job && open && chosenStore ? chosenStore : undefined);
  const storeWhatsapp = store.data?.whatsapp;
  useEffect(() => {
    if (!storeWhatsapp || form.getFieldState("whatsapp").isDirty) return;
    form.setValue("whatsapp", formatWhatsapp(storeWhatsapp));
  }, [storeWhatsapp, form]);

  const close = () => {
    form.reset();
    save.reset();
    onClose();
  };
  const tryClose = async () => {
    if (
      Object.keys(dirtyFields).length > 0 &&
      !(await confirmar({
        title: "Descartar a vaga?",
        description: "O que foi digitado nesta janela se perde.",
        confirmLabel: "Descartar",
        cancelLabel: "Continuar editando",
        danger: true,
      }))
    )
      return;
    close();
  };
  const onSubmit = form.handleSubmit((values) => {
    const { storeId: _store, ...changes } = values;
    // Editar manda só o que mudou. `days` renova o prazo a partir de hoje: vai se mexeram
    // nele ou se a vaga já saiu do ar (editar uma encerrada a republica).
    const dirty = { ...form.formState.dirtyFields, ...(job?.isLive ? {} : { days: true }) };
    const input = job ? { id: job.id, body: pickDirty(changes, dirty) } : { body: values };
    save.mutate(input, {
      onSuccess: () => {
        toast.success(job ? "Vaga salva." : "Vaga publicada.");
        close();
      },
      onError: (e) => {
        if (!applyApiErrors(e, form.setError, ["storeId", "title", "text", "whatsapp", "days"])) {
          toast.error(errorMessage(e));
        }
      },
    });
  });
  const validDays = typeof days === "number" && days >= 1 && days <= 90;

  return (
    <Modal
      open={open}
      onClose={() => void tryClose()}
      busy={save.isPending}
      title={job ? "Editar vaga" : "Publicar vaga"}
      description="Aparece em “Vagas na ARP” no app, com o botão do WhatsApp."
      footer={
        <>
          <Button variant="secondary" onClick={() => void tryClose()} disabled={save.isPending}>
            Voltar
          </Button>
          <Button type="submit" form="form-vaga" loading={save.isPending}>
            {job ? (job.isLive ? "Salvar" : "Salvar e republicar") : "Publicar"}
          </Button>
        </>
      }
    >
      <form id="form-vaga" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {!storeId && !job && (
          <Field label="Loja" required error={errors.storeId?.message}>
            <Controller
              control={form.control}
              name="storeId"
              render={({ field }) => (
                <StoreSelect
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? "")}
                  onBlur={field.onBlur}
                />
              )}
            />
          </Field>
        )}
        <Field label="Cargo" required error={errors.title?.message}>
          <Input autoFocus placeholder="Garçom ou garçonete" {...form.register("title")} />
        </Field>
        <Field
          label="WhatsApp para candidatos"
          required
          hint={
            storeWhatsapp && !dirtyFields.whatsapp
              ? "O WhatsApp da loja. Troque se for outro."
              : "Com DDD, ex.: (22) 99999-0000"
          }
          error={errors.whatsapp?.message}
        >
          <Controller
            control={form.control}
            name="whatsapp"
            render={({ field }) => (
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(22) 99999-0000"
                value={field.value}
                onChange={(e) => field.onChange(formatWhatsapp(e.target.value))}
                onBlur={field.onBlur}
                ref={field.ref}
              />
            )}
          />
        </Field>
        <Field label="Texto" hint="Ou envie a imagem da vaga." error={errors.text?.message}>
          <Textarea rows={4} maxLength={1500} {...form.register("text")} />
        </Field>
        <Field label="Imagem" optional>
          <Controller
            control={form.control}
            name="imageUrl"
            render={({ field }) => (
              <ImageUpload label="imagem da vaga" value={field.value} onChange={field.onChange} />
            )}
          />
        </Field>
        <Field
          label="Dias no ar"
          required
          hint={
            validDays
              ? `Sai do ar em ${formatDate(new Date(Date.now() + days * DAY_MS))}${job?.isLive ? " (ao mudar, conta a partir de hoje)" : ""}.`
              : "De 1 a 90 dias."
          }
          error={errors.days?.message}
          className="max-w-xs"
        >
          <Input
            type="number"
            min={1}
            max={90}
            {...form.register("days", { valueAsNumber: true })}
          />
        </Field>
      </form>
    </Modal>
  );
}

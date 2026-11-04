import { createJobBodySchema, JOB_DEFAULT_DAYS, type Job } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { BriefcaseBusiness, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { useStoreOptions } from "@/features/stores";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { useAuth } from "@/shared/auth";
import { formatDate, formatRelative } from "@/shared/lib/format";
import { pickDirty } from "@/shared/lib/forms";
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
  ImageUpload,
  Input,
  Modal,
  PageHeader,
  Segmented,
  Select,
  StatusBadge,
  Table,
  Textarea,
  toast,
} from "@/shared/ui";
import { useJobs, useRemoveJob, useSaveJob } from "../api";

type Status = "live" | "expired";

/** Vagas de emprego das lojas (Fase 2). Saem do app sozinhas no prazo. */
export function JobsPage() {
  const { can, user } = useAuth();
  const canEdit = can("jobs.manage");
  const ownStore = user?.store ?? null;
  const [status, setStatus] = useState<Status>("live");
  const jobs = useJobs({ status });
  const remove = useRemoveJob();
  const [editing, setEditing] = useState<Job | "new" | null>(null);
  const [removing, setRemoving] = useState<Job | null>(null);

  const columns: Column<Job>[] = [
    {
      key: "title",
      header: "Vaga",
      cell: (j) => (
        <span className="flex flex-col">
          <span className="font-medium">{j.title}</span>
          <span className="text-xs text-neutral-500">{j.store.name}</span>
        </span>
      ),
    },
    { key: "published", header: "Publicada", cell: (j) => formatDate(j.publishedAt) },
    {
      key: "expires",
      header: "Sai do ar",
      cell: (j) =>
        j.isLive ? (
          formatRelative(j.expiresAt)
        ) : (
          <StatusBadge tone="neutral">Saiu em {formatDate(j.expiresAt)}</StatusBadge>
        ),
    },
    ...(canEdit
      ? [
          {
            key: "actions",
            header: <span className="sr-only">Ações</span>,
            numeric: true,
            cell: (j: Job) => (
              <span className="inline-flex gap-1">
                <IconButton
                  icon={Pencil}
                  size="sm"
                  label={`Editar ${j.title}`}
                  onClick={() => setEditing(j)}
                />
                <IconButton
                  icon={Trash2}
                  size="sm"
                  variant="danger"
                  label={`Tirar ${j.title} do ar`}
                  onClick={() => setRemoving(j)}
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
          title={status === "live" ? "No ar" : "Já saíram do ar"}
          action={
            <Segmented
              label="Situação"
              value={status}
              onChange={setStatus}
              options={[
                { value: "live", label: "No ar" },
                { value: "expired", label: "Encerradas" },
              ]}
            />
          }
        />
        {jobs.error ? (
          <ErrorState compact error={jobs.error} onRetry={() => void jobs.refetch()} />
        ) : (
          <Table
            caption="Vagas"
            columns={columns}
            rows={jobs.data}
            rowKey={(j) => j.id}
            loading={jobs.isLoading}
            skeletonRows={4}
            empty={<EmptyState compact icon={BriefcaseBusiness} title="Nenhuma vaga aqui" />}
          />
        )}
      </Card>
      <JobFormModal
        open={editing !== null}
        job={editing === "new" || editing === null ? undefined : editing}
        storeId={ownStore?.id ?? null}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        open={removing !== null}
        onClose={() => {
          setRemoving(null);
          remove.reset();
        }}
        danger
        title={`Tirar ${removing?.title ?? "a vaga"} do ar?`}
        description="A vaga some do app na hora."
        confirmLabel="Tirar do ar"
        loading={remove.isPending}
        error={remove.error}
        onConfirm={() =>
          removing &&
          remove.mutate(removing.id, {
            onSuccess: () => {
              toast.success("Vaga tirada do ar.");
              setRemoving(null);
            },
          })
        }
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

/** Publicar ou editar vaga. Lojista: a loja dele já vem marcada. A loja não muda na edição. */
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
  const stores = useStoreOptions({ enabled: open && !storeId && !job });
  const form = useForm<Input_, unknown, Values>({
    resolver: zodResolver(createJobBodySchema),
    values: job
      ? {
          storeId: job.store.id,
          title: job.title,
          text: job.text,
          imageUrl: job.imageUrl,
          whatsapp: job.whatsapp,
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
  const { errors } = form.formState;
  const days = form.watch("days");
  const close = () => {
    form.reset();
    save.reset();
    onClose();
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
      onClose={close}
      busy={save.isPending}
      title={job ? "Editar vaga" : "Publicar vaga"}
      description="Aparece em “Vagas na ARP” no app, com o botão do WhatsApp."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="form-vaga" loading={save.isPending}>
            {job ? "Salvar" : "Publicar"}
          </Button>
        </>
      }
    >
      <form id="form-vaga" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {!storeId && !job && (
          <Field label="Loja" required error={errors.storeId?.message}>
            <Select placeholder="Escolha a loja" {...form.register("storeId")}>
              {(stores.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Cargo" required error={errors.title?.message}>
          <Input autoFocus placeholder="Garçom ou garçonete" {...form.register("title")} />
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
          label="WhatsApp para candidatos"
          required
          hint="Só números, com DDD (ex.: 5524999990000)"
          error={errors.whatsapp?.message}
        >
          <Input inputMode="numeric" {...form.register("whatsapp")} />
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

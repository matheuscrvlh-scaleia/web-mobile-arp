import { createJobBodySchema, type Job } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { BriefcaseBusiness, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { useStoreOptions } from "@/features/stores";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { useAuth } from "@/shared/auth";
import { formatDate, formatRelative } from "@/shared/lib/format";
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
import { useCreateJob, useJobs, useRemoveJob } from "../api";

type Status = "live" | "expired";

/** Vagas de emprego das lojas (Fase 2). Saem do app sozinhas no prazo. */
export function JobsPage() {
  const { can, user } = useAuth();
  const canEdit = can("jobs.manage");
  const ownStore = user?.store ?? null;
  const [status, setStatus] = useState<Status>("live");
  const jobs = useJobs({ status });
  const remove = useRemoveJob();
  const [creating, setCreating] = useState(false);
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
              <IconButton
                icon={Trash2}
                size="sm"
                variant="danger"
                label={`Tirar ${j.title} do ar`}
                onClick={() => setRemoving(j)}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Vagas"
        description="Vagas de emprego das lojas. Ficam no menu do app e saem do ar sozinhas no prazo (Configurações)."
        actions={
          canEdit && (
            <Button icon={Plus} onClick={() => setCreating(true)}>
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
        open={creating}
        storeId={ownStore?.id ?? null}
        onClose={() => setCreating(false)}
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

/** Publicar vaga. Lojista: a loja dele já vem marcada. */
function JobFormModal({
  open,
  storeId,
  onClose,
}: {
  open: boolean;
  storeId: string | null;
  onClose: () => void;
}) {
  const create = useCreateJob();
  const stores = useStoreOptions({ enabled: open && !storeId });
  const form = useForm<Input_, unknown, Values>({
    resolver: zodResolver(createJobBodySchema),
    values: { storeId: storeId ?? "", title: "", text: "", imageUrl: null, whatsapp: "" },
  });
  const { errors } = form.formState;
  const close = () => {
    form.reset();
    create.reset();
    onClose();
  };
  const onSubmit = form.handleSubmit((values) =>
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Vaga publicada.");
        close();
      },
      onError: (e) => {
        if (!applyApiErrors(e, form.setError, ["storeId", "title", "text", "whatsapp"])) {
          toast.error(errorMessage(e));
        }
      },
    }),
  );

  return (
    <Modal
      open={open}
      onClose={close}
      busy={create.isPending}
      title="Publicar vaga"
      description="Aparece em “Vagas na ARP” no app, com o botão do WhatsApp."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={create.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="form-vaga" loading={create.isPending}>
            Publicar
          </Button>
        </>
      }
    >
      <form id="form-vaga" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {!storeId && (
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
      </form>
    </Modal>
  );
}

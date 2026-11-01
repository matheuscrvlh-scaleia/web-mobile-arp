import { createRoleBodySchema, type Role } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, ShieldCheck, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";
import type { z } from "zod";
import { PeopleTabs } from "@/features/users";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { useUnsavedChangesGuard } from "@/shared/hooks";
import { plural } from "@/shared/lib/format";
import { saveInput } from "@/shared/lib/forms";
import { emptyToNull } from "@/shared/lib/text";
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  FormSection,
  Input,
  LoadingRegion,
  PageHeader,
  SaveBar,
  Skeleton,
  Textarea,
  toast,
} from "@/shared/ui";
import { useDeleteRole, useRoles, useSaveRole } from "../api";
import { PermissionEditor } from "../components/PermissionEditor";

type Input_ = z.input<typeof createRoleBodySchema>;
type Values = z.output<typeof createRoleBodySchema>;
const FIELDS = ["name", "description", "permissions"];

/** Criar (/cargos/novo) e editar (/cargos/:id) cargo. */
export function RoleEditPage() {
  const { id } = useParams();
  const roles = useRoles();
  if (!id) return <RoleForm />;
  if (roles.error) {
    return (
      <Card>
        <ErrorState error={roles.error} onRetry={() => void roles.refetch()} />
      </Card>
    );
  }
  if (!roles.data) {
    return (
      <LoadingRegion>
        <Skeleton className="h-14 w-72 rounded-full" />
        <Skeleton className="h-[32rem] rounded-[1.75rem]" />
      </LoadingRegion>
    );
  }
  const role = roles.data.find((r) => r.id === id);
  if (!role) {
    return (
      <Card padding="lg">
        <EmptyState
          icon={ShieldCheck}
          title="Cargo não encontrado"
          description="Ele pode ter sido apagado."
        />
      </Card>
    );
  }
  return <RoleForm key={role.id} role={role} />;
}

function RoleForm({ role }: { role?: Role }) {
  const navigate = useNavigate();
  const { can } = useAuth();
  const save = useSaveRole();
  const remove = useDeleteRole();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const readOnly = !can("users.manage");
  const locked = Boolean(role?.isSystem);

  const form = useForm<Input_, unknown, Values>({
    resolver: zodResolver(createRoleBodySchema),
    values: useMemo(
      () => ({
        name: role?.name ?? "",
        description: role?.description ?? null,
        permissions: role?.permissions ?? [],
      }),
      [role],
    ),
    resetOptions: { keepDirtyValues: true },
  });
  const { errors, isDirty, dirtyFields } = form.formState;
  const { allowLeave } = useUnsavedChangesGuard(isDirty && !save.isPending);

  const onSubmit = form.handleSubmit((values) => {
    const input = saveInput(role?.id, values, dirtyFields);
    // Cargo do sistema: só nome e descrição (as permissões são todas, sempre).
    if ("id" in input && locked) delete input.body.permissions;
    if (Object.keys(input.body).length === 0) return;
    save.mutate(input, {
      onSuccess: () => {
        toast.success(
          role ? "Cargo salvo. Vale no próximo acesso de quem tem o cargo." : "Cargo criado.",
        );
        form.reset(values);
        if (!role) {
          allowLeave();
          navigate(PATHS.roles);
        }
      },
      onError: (e) => {
        if (!applyApiErrors(e, form.setError, FIELDS)) toast.error(errorMessage(e));
      },
    });
  });

  return (
    <>
      <PageHeader
        title={role ? role.name : "Novo cargo"}
        description={
          role
            ? `${plural(role.usersCount, "pessoa tem", "pessoas têm")} este cargo.`
            : "Dê um nome e marque o que o cargo pode ver e fazer."
        }
        back={{ to: PATHS.roles, label: "Cargos" }}
        actions={
          role &&
          role.usersCount > 0 && (
            <Link
              to={`${PATHS.users}?roleId=${role.id}`}
              className="inline-flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900"
            >
              <Users className="size-4" aria-hidden />
              Ver quem tem o cargo
            </Link>
          )
        }
      />
      <PeopleTabs />
      {locked && (
        <p className="mb-5 flex items-start gap-2 rounded-2xl bg-neutral-900 px-4 py-3 text-sm text-white">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          Cargo do sistema: tem todas as permissões e não pode ser apagado nem perder acesso.
        </p>
      )}
      <form onSubmit={onSubmit} noValidate>
        <fieldset disabled={readOnly} className="min-w-0">
          <Card padding="lg">
            <FormSection
              title="Cargo"
              description="Como aparece na escolha do cargo de cada pessoa."
            >
              <Field label="Nome" required error={errors.name?.message}>
                <Input autoFocus={!role} {...form.register("name")} />
              </Field>
              <Field label="Descrição" optional error={errors.description?.message}>
                <Textarea
                  rows={2}
                  maxLength={240}
                  {...form.register("description", { setValueAs: emptyToNull })}
                />
              </Field>
            </FormSection>
            <FormSection
              title="Permissões"
              description="Marcar “gerenciar” também libera o “ver” do mesmo assunto."
              wide
            >
              <Controller
                control={form.control}
                name="permissions"
                render={({ field }) => (
                  <PermissionEditor
                    value={field.value}
                    onChange={field.onChange}
                    locked={locked || readOnly}
                  />
                )}
              />
              {errors.permissions?.message && (
                <p role="alert" className="text-xs font-medium text-red-700">
                  {errors.permissions.message}
                </p>
              )}
            </FormSection>
          </Card>
        </fieldset>
        {!readOnly && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {role && !locked ? (
              <Button
                variant="ghost"
                icon={Trash2}
                className="mt-6"
                disabled={role.usersCount > 0}
                title={role.usersCount > 0 ? "Mude as pessoas de cargo antes de apagar" : undefined}
                onClick={() => setConfirmDelete(true)}
              >
                Apagar cargo
              </Button>
            ) : (
              <span />
            )}
            <SaveBar
              dirty={isDirty}
              saving={save.isPending}
              alwaysVisible={!role}
              onReset={role ? () => form.reset() : undefined}
              submitLabel={role ? "Salvar cargo" : "Criar cargo"}
            />
          </div>
        )}
      </form>
      {role && (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => {
            setConfirmDelete(false);
            remove.reset();
          }}
          danger
          title={`Apagar o cargo ${role.name}?`}
          description="Só cargos sem ninguém podem ser apagados."
          confirmLabel="Apagar"
          loading={remove.isPending}
          error={remove.error}
          onConfirm={() =>
            remove.mutate(role.id, {
              onSuccess: () => {
                toast.success("Cargo apagado.");
                allowLeave();
                navigate(PATHS.roles);
              },
            })
          }
        />
      )}
    </>
  );
}

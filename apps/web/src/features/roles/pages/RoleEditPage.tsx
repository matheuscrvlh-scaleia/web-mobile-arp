import { createRoleBodySchema, PERMISSIONS, type Role } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, Lock, ShieldCheck, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";
import type { z } from "zod";
import { PeopleTabs } from "@/features/users";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import {
  copyName,
  duplicateHref,
  useDuplicateSource,
  useUnsavedChangesGuard,
} from "@/shared/hooks";
import { plural } from "@/shared/lib/format";
import { saveInput } from "@/shared/lib/forms";
import { emptyToNull } from "@/shared/lib/text";
import {
  ActionMenu,
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

/** Criar (/cargos/novo, ou ?de=<id> para duplicar) e editar (/cargos/:id) cargo. */
export function RoleEditPage() {
  const { id } = useParams();
  const sourceId = useDuplicateSource();
  const roles = useRoles();
  if (!id) {
    const source = sourceId ? roles.data?.find((r) => r.id === sourceId) : undefined;
    // Duplicar: espera a lista para o formulário já nascer preenchido.
    if (sourceId && !roles.data && !roles.error) {
      return (
        <LoadingRegion>
          <Skeleton className="h-14 w-72 rounded-full" />
          <Skeleton className="h-[32rem] rounded-[1.75rem]" />
        </LoadingRegion>
      );
    }
    return <RoleForm key={source?.id ?? "novo"} source={source} />;
  }
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
          description="Ele pode ter sido excluído."
        />
      </Card>
    );
  }
  return <RoleForm key={role.id} role={role} />;
}

function RoleForm({ role, source }: { role?: Role; source?: Role }) {
  const navigate = useNavigate();
  const { can } = useAuth();
  const save = useSaveRole();
  const remove = useDeleteRole();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const locked = Boolean(role?.isSystem);
  // Cargo do sistema abre só para leitura: o TI vê o que ele libera.
  const readOnly = !can("users.manage") || locked;

  const form = useForm<Input_, unknown, Values>({
    resolver: zodResolver(createRoleBodySchema),
    values: useMemo(
      () =>
        source
          ? {
              name: copyName(source.name),
              description: source.description,
              // Cópia do Administrador: tudo marcado, mas editável.
              permissions: source.isSystem ? [...PERMISSIONS] : source.permissions,
            }
          : {
              name: role?.name ?? "",
              description: role?.description ?? null,
              permissions: role?.permissions ?? [],
            },
      [role, source],
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
        title={role ? role.name : source ? "Duplicar cargo" : "Novo cargo"}
        description={
          role
            ? `${plural(role.usersCount, "pessoa tem", "pessoas têm")} este cargo.`
            : source
              ? `Cópia de ${source.name}: mude o nome e o que precisar.`
              : "Dê um nome e marque o que o cargo pode ver e fazer."
        }
        back={{ to: PATHS.roles, label: "Cargos" }}
        actions={
          role && (
            <div className="flex flex-wrap items-center gap-3">
              {role.usersCount > 0 && (
                <Link
                  to={`${PATHS.users}?roleId=${role.id}`}
                  className="inline-flex min-h-11 items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900"
                >
                  <Users className="size-4" aria-hidden />
                  Ver quem tem o cargo
                </Link>
              )}
              {can("users.manage") && (
                <ActionMenu
                  label="Mais"
                  ariaLabel={`Mais ações do cargo ${role.name}`}
                  items={[
                    {
                      label: "Duplicar",
                      icon: Copy,
                      onSelect: () => navigate(duplicateHref(PATHS.roleNew, role.id)),
                    },
                    !locked && {
                      label: "Excluir",
                      icon: Trash2,
                      danger: true,
                      disabled: role.usersCount > 0,
                      hint:
                        role.usersCount > 0
                          ? `${plural(role.usersCount, "pessoa tem", "pessoas têm")} este cargo: mude o cargo delas antes`
                          : undefined,
                      onSelect: () => setConfirmDelete(true),
                    },
                  ]}
                />
              )}
            </div>
          )
        }
      />
      <PeopleTabs />
      {locked && (
        <p className="mb-5 flex items-start gap-2 rounded-2xl bg-neutral-900 px-4 py-3 text-sm text-white">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          Cargo do sistema: não pode ser editado nem excluído. Ele tem todas as permissões,
          inclusive as que forem criadas depois.
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
                  <PermissionEditor value={field.value} onChange={field.onChange} locked={locked} />
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
          <div className="flex flex-wrap items-center justify-end gap-3">
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
          title={`Excluir o cargo ${role.name}?`}
          description="Ninguém tem este cargo. Ele some da lista e não volta."
          confirmLabel="Excluir cargo"
          loading={remove.isPending}
          error={remove.error}
          onConfirm={() =>
            remove.mutate(role.id, {
              onSuccess: () => {
                toast.success("Cargo excluído.");
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

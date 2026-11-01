import type { User } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, KeyRound, LogIn, Power, PowerOff, UserX } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { useDocumentTitle, useUnsavedChangesGuard } from "@/shared/hooks";
import { formatDateTime, formatRelative } from "@/shared/lib/format";
import { pickDirty } from "@/shared/lib/forms";
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  InfoItem,
  LoadError,
  LoadingRegion,
  PageHeader,
  SaveBar,
  Skeleton,
  toast,
} from "@/shared/ui";
import { useResetPassword, useUpdateUser, useUser } from "../api";
import { PeopleTabs } from "../components/PeopleTabs";
import { TemporaryPasswordModal } from "../components/TemporaryPasswordModal";
import { StoreAccessBadge, UserStatusBadge } from "../components/UserBadges";
import {
  USER_PROFILE_FIELDS,
  UserFields,
  type UserProfileInput,
  type UserProfileValues,
  userProfileSchema,
} from "../components/UserFields";

export function UserDetailPage() {
  const { id = "" } = useParams();
  const user = useUser(id);
  useDocumentTitle(user.data?.name ?? "Usuário");

  if (user.error) {
    return (
      <LoadError
        error={user.error}
        onRetry={() => void user.refetch()}
        icon={UserX}
        title="Usuário não encontrado"
        back={{ to: PATHS.users, label: "Ver usuários" }}
      />
    );
  }
  if (!user.data) {
    return (
      <LoadingRegion>
        <Skeleton className="h-14 w-80 rounded-full" />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <Skeleton className="h-96 rounded-[1.75rem]" />
          <Skeleton className="h-72 rounded-[1.75rem]" />
        </div>
      </LoadingRegion>
    );
  }
  return <UserDetail user={user.data} />;
}

function UserDetail({ user }: { user: User }) {
  const { can, user: me } = useAuth();
  const manage = can("users.manage");
  const update = useUpdateUser(user.id);
  const reset = useResetPassword(user.id);
  const [confirm, setConfirm] = useState<"status" | "password" | null>(null);
  const [temporary, setTemporary] = useState<string | null>(null);
  const isMe = me?.id === user.id;

  const form = useForm<UserProfileInput, unknown, UserProfileValues>({
    resolver: zodResolver(userProfileSchema),
    values: useMemo(
      () => ({
        name: user.name,
        email: user.email,
        roleId: user.role.id,
        storeId: user.store?.id ?? null,
      }),
      [user],
    ),
    resetOptions: { keepDirtyValues: true },
  });
  useUnsavedChangesGuard(form.formState.isDirty && !update.isPending);

  const onSubmit = form.handleSubmit((values) => {
    const body = pickDirty(values, form.formState.dirtyFields);
    if (Object.keys(body).length === 0) return;
    update.mutate(body, {
      onSuccess: () => {
        form.reset(values);
        toast.success(
          isMe ? "Dados salvos. Mudanças de cargo valem no próximo acesso." : "Usuário salvo.",
        );
      },
      onError: (e) => {
        if (!applyApiErrors(e, form.setError, USER_PROFILE_FIELDS)) toast.error(errorMessage(e));
      },
    });
  });

  const disabling = user.status === "active";

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-4">
            <Avatar name={user.name} size="lg" muted={user.status === "disabled"} />
            <span className="min-w-0">{user.name}</span>
          </span>
        }
        documentTitle={user.name}
        description={user.email}
        back={{ to: PATHS.users, label: "Usuários" }}
      />
      <PeopleTabs />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <form onSubmit={onSubmit} noValidate>
          <fieldset disabled={!manage} className="min-w-0">
            <Card padding="lg">
              <UserFields form={form} />
            </Card>
          </fieldset>
          {manage && (
            <SaveBar
              dirty={form.formState.isDirty}
              saving={update.isPending}
              onReset={() => form.reset()}
              submitLabel="Salvar usuário"
            />
          )}
        </form>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Situação" />
            <div className="mb-5 flex flex-wrap gap-2">
              <UserStatusBadge user={user} />
              <StoreAccessBadge store={user.store} />
            </div>
            <div className="flex flex-col gap-4">
              <InfoItem label="Último acesso" icon={LogIn}>
                {user.lastLoginAt ? (
                  <time dateTime={user.lastLoginAt} title={formatDateTime(user.lastLoginAt)}>
                    {formatRelative(user.lastLoginAt)}
                  </time>
                ) : (
                  "Ainda não entrou"
                )}
              </InfoItem>
              <InfoItem label="Criado em" icon={CalendarClock}>
                {formatDateTime(user.createdAt)}
              </InfoItem>
            </div>
          </Card>
          {manage && (
            <Card>
              <CardHeader title="Acesso" description="Senha e bloqueio da conta." />
              <div className="flex flex-col gap-2">
                <Button variant="secondary" icon={KeyRound} onClick={() => setConfirm("password")}>
                  Gerar nova senha provisória
                </Button>
                <Button
                  variant={disabling ? "ghost" : "brand"}
                  icon={disabling ? PowerOff : Power}
                  disabled={isMe}
                  title={isMe ? "Você não pode desativar a própria conta" : undefined}
                  onClick={() => setConfirm("status")}
                >
                  {disabling ? "Desativar usuário" : "Reativar usuário"}
                </Button>
                {isMe && (
                  <p className="text-xs text-neutral-500">
                    Você não pode desativar a própria conta.
                  </p>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirm === "password"}
        onClose={() => {
          setConfirm(null);
          reset.reset();
        }}
        title={`Gerar nova senha para ${user.name}?`}
        description="A senha atual para de funcionar e as sessões abertas são encerradas. A pessoa cria uma nova no próximo acesso."
        confirmLabel="Gerar senha"
        loading={reset.isPending}
        error={reset.error}
        onConfirm={() =>
          reset.mutate(undefined, {
            onSuccess: ({ temporaryPassword }) => {
              setConfirm(null);
              setTemporary(temporaryPassword);
            },
          })
        }
      />
      <ConfirmDialog
        open={confirm === "status"}
        onClose={() => {
          setConfirm(null);
          update.reset();
        }}
        danger={disabling}
        title={disabling ? `Desativar ${user.name}?` : `Reativar ${user.name}?`}
        description={
          disabling
            ? "A pessoa perde o acesso ao painel na hora. O histórico do que ela fez continua."
            : "A pessoa volta a entrar com a senha que já tinha."
        }
        confirmLabel={disabling ? "Desativar" : "Reativar"}
        loading={update.isPending}
        error={update.error}
        onConfirm={() =>
          update.mutate(
            { status: disabling ? "disabled" : "active" },
            {
              onSuccess: () => {
                setConfirm(null);
                toast.success(disabling ? "Usuário desativado." : "Usuário reativado.");
              },
            },
          )
        }
      />
      <TemporaryPasswordModal
        password={temporary}
        userName={user.name}
        onClose={() => setTemporary(null)}
      />
    </>
  );
}

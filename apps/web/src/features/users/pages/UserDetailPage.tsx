import { passwordSchema, type User } from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, KeyRound, LogIn, UserX } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";
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
  FormSection,
  InfoItem,
  LoadError,
  LoadingRegion,
  PageHeader,
  SaveBar,
  Skeleton,
  toast,
} from "@/shared/ui";
import { useResetPassword, useUpdateUser, useUser } from "../api";
import { PasswordField } from "../components/PasswordField";
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
import { UserQuickActions } from "../components/UserQuickActions";

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
  const navigate = useNavigate();
  const update = useUpdateUser(user.id);
  const reset = useResetPassword(user.id);
  const [confirmReset, setConfirmReset] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string>();
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

  // Vazio: a API gera. Preenchido: precisa seguir a regra de senha.
  const askReset = () => {
    if (newPassword) {
      const parsed = passwordSchema.safeParse(newPassword);
      if (!parsed.success) {
        setPasswordError(parsed.error.issues[0]?.message);
        return;
      }
    }
    setPasswordError(undefined);
    setConfirmReset(true);
  };

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
        actions={<UserQuickActions user={user} onDeleted={() => navigate(PATHS.users)} />}
      />
      <PeopleTabs />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-5">
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

          {/* Mesmo desenho do copiloto: cartão largo, título à esquerda e campo à direita. */}
          {manage && !isMe && (
            <Card padding="lg">
              <FormSection
                title="Redefinir senha"
                description="Se a pessoa esqueceu a senha, defina uma provisória. No próximo acesso ela escolhe uma nova."
              >
                <div className="max-w-xl">
                  <PasswordField
                    value={newPassword}
                    onChange={(v) => {
                      setNewPassword(v);
                      setPasswordError(undefined);
                    }}
                    placeholder="Em branco, o sistema gera"
                    hint="8 caracteres ou mais, com letra e número. As sessões abertas são encerradas."
                    error={passwordError}
                  />
                </div>
                <Button
                  variant="secondary"
                  icon={KeyRound}
                  onClick={askReset}
                  className="self-start"
                >
                  Redefinir senha
                </Button>
              </FormSection>
            </Card>
          )}
          {isMe && (
            <Card padding="lg">
              <FormSection title="Sua senha" description="A sua senha você troca em Minha conta.">
                <Link to={PATHS.account} className="self-start text-sm font-medium hover:underline">
                  Trocar a minha senha →
                </Link>
              </FormSection>
            </Card>
          )}
        </div>

        <Card className="self-start">
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
      </div>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => {
          setConfirmReset(false);
          reset.reset();
        }}
        title={`Redefinir a senha de ${user.name}?`}
        description="A senha atual para de funcionar e as sessões abertas são encerradas. A pessoa cria uma nova no próximo acesso."
        confirmLabel="Redefinir senha"
        loading={reset.isPending}
        error={reset.error}
        onConfirm={() =>
          reset.mutate(newPassword || undefined, {
            onSuccess: ({ temporaryPassword }) => {
              setConfirmReset(false);
              setNewPassword("");
              setTemporary(temporaryPassword);
            },
          })
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

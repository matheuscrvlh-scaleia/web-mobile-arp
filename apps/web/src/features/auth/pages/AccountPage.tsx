import { KeyRound, LogOut, Mail, Store, UserRound } from "lucide-react";
import { useState } from "react";
import { useAuth, useCurrentUser } from "@/shared/auth";
import { Avatar, Button, Card, CardHeader, PageHeader } from "@/shared/ui";
import { ChangePasswordForm } from "./ChangePasswordPage";

/** Minha conta: quem eu sou no painel e trocar a própria senha. */
export function AccountPage() {
  const user = useCurrentUser();
  const { signOut } = useAuth();
  const [leaving, setLeaving] = useState(false);
  return (
    <>
      <PageHeader
        title="Minha conta"
        description="Seus dados de acesso ao painel."
        actions={
          <Button
            variant="secondary"
            icon={LogOut}
            loading={leaving}
            onClick={() => {
              setLeaving(true);
              void signOut();
            }}
          >
            Sair
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <Card padding="lg">
          <div className="flex items-center gap-4">
            <Avatar name={user.name} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{user.name}</p>
              <p className="truncate text-sm text-neutral-500">{user.role.name}</p>
            </div>
          </div>
          <dl className="mt-5 flex flex-col gap-3 text-sm">
            <div className="flex items-center gap-2">
              <dt className="flex items-center gap-1.5 text-neutral-500">
                <Mail className="size-4" aria-hidden />
                <span className="sr-only">E-mail</span>
              </dt>
              <dd className="min-w-0 break-all">{user.email}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="flex items-center gap-1.5 text-neutral-500">
                <UserRound className="size-4" aria-hidden />
                <span className="sr-only">Cargo</span>
              </dt>
              <dd>{user.role.name}</dd>
            </div>
            {user.store && (
              <div className="flex items-center gap-2">
                <dt className="flex items-center gap-1.5 text-neutral-500">
                  <Store className="size-4" aria-hidden />
                  <span className="sr-only">Loja</span>
                </dt>
                <dd>{user.store.name}</dd>
              </div>
            )}
          </dl>
          <p className="mt-5 text-xs text-neutral-500">
            Nome, e-mail e cargo são alterados por quem administra os usuários do painel.
          </p>
        </Card>
        <Card padding="lg">
          <CardHeader
            icon={KeyRound}
            title="Trocar senha"
            description="Informe a senha atual e escolha uma nova."
          />
          <div className="mt-4 max-w-md">
            <ChangePasswordForm onDone={() => undefined} />
          </div>
        </Card>
      </div>
    </>
  );
}

import { PERMISSIONS } from "@arp/contracts";
import { ChevronRight, Lock, Plus, ShieldCheck, Users } from "lucide-react";
import { Link } from "react-router";
import { PeopleTabs } from "@/features/users";
import { PATHS } from "@/shared/config/paths";
import { plural } from "@/shared/lib/format";
import {
  ButtonLink,
  Can,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  SkeletonGrid,
  StatusBadge,
} from "@/shared/ui";
import { useRoles } from "../api";

export function RolesPage() {
  const roles = useRoles();
  return (
    <>
      <PageHeader
        title="Cargos"
        description="Cada cargo libera um conjunto de telas e ações. A mudança vale no próximo acesso de quem tem o cargo (até 15 min)."
        actions={
          <Can permission="users.manage">
            <ButtonLink to={PATHS.roleNew} icon={Plus}>
              Novo cargo
            </ButtonLink>
          </Can>
        }
      />
      <PeopleTabs />
      {roles.error ? (
        <Card>
          <ErrorState error={roles.error} onRetry={() => void roles.refetch()} />
        </Card>
      ) : !roles.data ? (
        <SkeletonGrid count={6} className="md:grid-cols-2 xl:grid-cols-3" itemClassName="h-44" />
      ) : roles.data.length === 0 ? (
        <Card>
          <EmptyState icon={ShieldCheck} title="Nenhum cargo ainda" />
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roles.data.map((r) => (
            <li key={r.id} className="flex">
              <Link
                to={PATHS.role(r.id)}
                className={`${r.isSystem ? "tom-escuro" : "vidro"} flutua group flex w-full flex-col gap-4 rounded-[1.75rem] p-5`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-10 place-items-center rounded-full bg-neutral-900/[0.06] text-neutral-700">
                    {r.isSystem ? (
                      <Lock className="size-4" aria-hidden />
                    ) : (
                      <ShieldCheck className="size-4" aria-hidden />
                    )}
                  </span>
                  <ChevronRight
                    className="size-4 text-neutral-400 transition group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </div>
                <div>
                  <p className="font-semibold text-neutral-900">{r.name}</p>
                  {r.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-neutral-500">{r.description}</p>
                  )}
                </div>
                <div className="mt-auto flex flex-wrap gap-1.5">
                  {r.isSystem ? (
                    <StatusBadge tone="dark" icon={Lock}>
                      Cargo do sistema
                    </StatusBadge>
                  ) : (
                    <StatusBadge tone="neutral" icon={ShieldCheck}>
                      {r.permissions.length} de {PERMISSIONS.length} permissões
                    </StatusBadge>
                  )}
                  <StatusBadge tone="info" icon={Users}>
                    {plural(r.usersCount, "pessoa", "pessoas")}
                  </StatusBadge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

import { listUsersQuerySchema, type User, userStatusSchema } from "@arp/contracts";
import { CircleOff, FilterX, Plus, SearchX, ShieldCheck, UserCheck, Users } from "lucide-react";
import { useCallback, useMemo } from "react";
import { Link } from "react-router";
import { useRoles } from "@/features/roles";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { useSearchText, useUrlState } from "@/shared/hooks";
import { formatDateTime, formatNumber, formatRelative } from "@/shared/lib/format";
import {
  Avatar,
  Button,
  ButtonLink,
  Can,
  Card,
  type Column,
  EmptyState,
  ErrorState,
  FilterBar,
  KpiCard,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  Table,
} from "@/shared/ui";
import { useUsers } from "../api";
import { PeopleTabs } from "../components/PeopleTabs";
import { StoreAccessBadge, UserStatusBadge } from "../components/UserBadges";
import { UserQuickActions } from "../components/UserQuickActions";

const STATUS_LABEL = { active: "Ativos", disabled: "Desativados" } as const;

const columns = (meId: string | undefined): Column<User>[] => [
  {
    key: "name",
    header: "Pessoa",
    primary: true,
    cell: (u) => (
      <span className="flex items-center gap-3">
        <Avatar name={u.name} muted={u.status === "disabled"} />
        <span className="min-w-0">
          <span className="flex items-center gap-2 font-medium text-neutral-900">
            {u.name}
            {u.id === meId && (
              <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-medium text-white">
                você
              </span>
            )}
          </span>
          <span className="block text-xs font-normal break-all text-neutral-500">{u.email}</span>
        </span>
      </span>
    ),
  },
  { key: "role", header: "Cargo", cell: (u) => u.role.name },
  {
    key: "store",
    header: "Loja",
    cell: (u) => <StoreAccessBadge store={u.store} />,
    className: "hidden md:table-cell",
  },
  { key: "status", header: "Situação", status: true, cell: (u) => <UserStatusBadge user={u} /> },
  {
    key: "lastLogin",
    header: "Último acesso",
    cell: (u) =>
      u.lastLoginAt ? (
        <time
          dateTime={u.lastLoginAt}
          title={formatDateTime(u.lastLoginAt)}
          className="text-neutral-600"
        >
          {formatRelative(u.lastLoginAt)}
        </time>
      ) : (
        <span className="text-neutral-400">Nunca entrou</span>
      ),
    className: "hidden lg:table-cell",
  },
  {
    key: "actions",
    header: <span className="sr-only">Ações</span>,
    numeric: true,
    actions: true,
    cell: (u) => <UserQuickActions user={u} compact />,
  },
];

/** Totais do topo: contagens leves (página de 1 item, só o total). */
function UserTotals({ rolesCount }: { rolesCount: number | undefined }) {
  const active = useUsers({ status: "active", pageSize: 1 });
  const disabled = useUsers({ status: "disabled", pageSize: 1 });
  const show = (n: number | undefined) => (n === undefined ? "—" : formatNumber(n));
  return (
    <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <KpiCard
        label="Com acesso"
        value={show(active.data?.meta.total)}
        hint="usuários ativos"
        icon={UserCheck}
      />
      <KpiCard
        label="Desativados"
        value={show(disabled.data?.meta.total)}
        hint="mantidos para o histórico"
        icon={CircleOff}
      />
      <KpiCard
        label="Cargos"
        value={show(rolesCount)}
        hint={
          <Link to={PATHS.roles} className="hover:underline">
            Ver e editar cargos →
          </Link>
        }
        icon={ShieldCheck}
      />
    </div>
  );
}

export function UsersPage() {
  const [query, setQuery] = useUrlState(listUsersQuerySchema);
  const commit = useCallback((q: string) => setQuery({ q }, { replace: true }), [setQuery]);
  const [search, setSearch] = useSearchText(query.q, commit);
  const users = useUsers(query);
  const roles = useRoles();
  const { user: me } = useAuth();
  const tableColumns = useMemo(() => columns(me?.id), [me?.id]);
  const filtered = Boolean(query.q || query.roleId || query.status || query.storeId);

  return (
    <>
      <PageHeader
        title="Usuários e cargos"
        description="Quem acessa o painel: equipe da ARP e lojistas. O cargo define o que cada um vê e faz."
        actions={
          <Can permission="users.manage">
            <ButtonLink to={PATHS.userNew} icon={Plus}>
              Novo usuário
            </ButtonLink>
          </Can>
        }
      />
      <PeopleTabs />
      <UserTotals rolesCount={roles.data?.length} />
      <FilterBar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nome ou e-mail"
          label="Buscar usuário"
          className="w-full sm:w-72"
        />
        <Select
          aria-label="Cargo"
          placeholder="Todos os cargos"
          value={query.roleId ?? ""}
          onChange={(e) => setQuery({ roleId: e.target.value })}
          className="w-full sm:w-52"
        >
          {(roles.data ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Situação"
          placeholder="Ativos e desativados"
          value={query.status ?? ""}
          onChange={(e) => setQuery({ status: e.target.value })}
          className="w-full sm:w-52"
        >
          {userStatusSchema.options.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            icon={FilterX}
            onClick={() => {
              setSearch("");
              setQuery({ q: undefined, roleId: undefined, status: undefined, storeId: undefined });
            }}
          >
            Limpar filtros
          </Button>
        )}
      </FilterBar>
      <Card>
        {users.error ? (
          <ErrorState error={users.error} onRetry={() => void users.refetch()} />
        ) : (
          <>
            <Table
              caption="Usuários do painel"
              columns={tableColumns}
              rows={users.data?.data}
              rowKey={(u) => u.id}
              rowHref={(u) => PATHS.user(u.id)}
              mobile="cards"
              loading={users.isLoading}
              empty={
                filtered ? (
                  <EmptyState compact icon={SearchX} title="Ninguém com esses filtros" />
                ) : (
                  <EmptyState compact icon={Users} title="Nenhum usuário ainda" />
                )
              }
            />
            {users.data && (
              <Pagination meta={users.data.meta} onPageChange={(page) => setQuery({ page })} />
            )}
          </>
        )}
      </Card>
    </>
  );
}

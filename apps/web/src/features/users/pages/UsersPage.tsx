import { listUsersQuerySchema, type User, userStatusSchema } from "@arp/contracts";
import { ChevronRight, FilterX, Plus, SearchX, Users } from "lucide-react";
import { useCallback } from "react";
import { Link } from "react-router";
import { useRoles } from "@/features/roles";
import { PATHS } from "@/shared/config/paths";
import { useSearchText, useUrlState } from "@/shared/hooks";
import { formatDateTime, formatRelative } from "@/shared/lib/format";
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
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  Table,
} from "@/shared/ui";
import { useUsers } from "../api";
import { PeopleTabs } from "../components/PeopleTabs";
import { StoreAccessBadge, UserStatusBadge } from "../components/UserBadges";

const STATUS_LABEL = { active: "Ativos", disabled: "Desativados" } as const;

const COLUMNS: Column<User>[] = [
  {
    key: "name",
    header: "Pessoa",
    cell: (u) => (
      <Link to={PATHS.user(u.id)} className="flex items-center gap-3 hover:underline">
        <Avatar name={u.name} muted={u.status === "disabled"} />
        <span className="min-w-0">
          <span className="block font-medium text-neutral-900">{u.name}</span>
          <span className="block text-xs text-neutral-500">{u.email}</span>
        </span>
      </Link>
    ),
  },
  { key: "role", header: "Cargo", cell: (u) => u.role.name },
  {
    key: "store",
    header: "Loja",
    cell: (u) => <StoreAccessBadge store={u.store} />,
    className: "hidden md:table-cell",
  },
  { key: "status", header: "Situação", cell: (u) => <UserStatusBadge user={u} /> },
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
    key: "open",
    header: <span className="sr-only">Abrir</span>,
    numeric: true,
    cell: (u) => (
      <Link
        to={PATHS.user(u.id)}
        aria-label={`Abrir ${u.name}`}
        className="inline-grid size-8 place-items-center rounded-full text-neutral-400 hover:bg-neutral-900/[0.06] hover:text-neutral-900"
      >
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    ),
  },
];

export function UsersPage() {
  const [query, setQuery] = useUrlState(listUsersQuerySchema);
  const commit = useCallback((q: string) => setQuery({ q }, { replace: true }), [setQuery]);
  const [search, setSearch] = useSearchText(query.q, commit);
  const users = useUsers(query);
  const roles = useRoles();
  const filtered = Boolean(query.q || query.roleId || query.status || query.storeId);

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Quem acessa o painel: equipe da ARP e lojistas."
        actions={
          <Can permission="users.manage">
            <ButtonLink to={PATHS.userNew} icon={Plus}>
              Novo usuário
            </ButtonLink>
          </Can>
        }
      />
      <PeopleTabs />
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
              columns={COLUMNS}
              rows={users.data?.data}
              rowKey={(u) => u.id}
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

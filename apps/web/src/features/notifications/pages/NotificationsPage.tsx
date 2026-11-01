import {
  listNotificationsQuerySchema,
  type NotificationStatus,
  notificationStatusSchema,
  type PushNotification,
} from "@arp/contracts";
import { Bell, CalendarX, ChevronRight, type LucideIcon, Plus, SearchX } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { useSearchText, useUrlState } from "@/shared/hooks";
import { formatNumber } from "@/shared/lib/format";
import {
  ButtonLink,
  Can,
  Card,
  type Column,
  EmptyState,
  ErrorState,
  FilterBar,
  IconButton,
  PageHeader,
  Pagination,
  SearchInput,
  Segmented,
  Table,
} from "@/shared/ui";
import { useNotifications } from "../api";
import { CancelNotificationDialog } from "../components/CancelNotificationDialog";
import {
  audienceText,
  NOTIFICATION_STATUS,
  NotificationStatusBadge,
  notificationWhen,
} from "../components/NotificationBadges";

type StatusFilter = NotificationStatus | "all";
const STATUS_PLURAL: Record<NotificationStatus, string> = {
  draft: "Rascunhos",
  scheduled: "Agendadas",
  sent: "Enviadas",
  cancelled: "Canceladas",
};
const STATUS_OPTIONS: { value: StatusFilter; label: string; icon?: LucideIcon }[] = [
  { value: "all", label: "Todas" },
  ...notificationStatusSchema.options.map((s) => ({
    value: s,
    label: STATUS_PLURAL[s],
    icon: NOTIFICATION_STATUS[s].icon,
  })),
];

function baseColumns(): Column<PushNotification>[] {
  return [
    {
      key: "message",
      header: "Notificação",
      cell: (n) => (
        <Link to={PATHS.notification(n.id)} className="block max-w-md min-w-56 hover:underline">
          <span className="block truncate font-medium text-neutral-900">{n.title}</span>
          <span className="block truncate text-xs text-neutral-500">{n.body}</span>
        </Link>
      ),
    },
    {
      key: "audience",
      header: "Público",
      cell: (n) => <span className="text-neutral-600">{audienceText(n)}</span>,
      className: "hidden md:table-cell",
    },
    {
      key: "status",
      header: "Situação",
      cell: (n) => (
        <span className="flex flex-col items-start gap-1">
          <NotificationStatusBadge status={n.status} />
          {notificationWhen(n) && (
            <span className="text-xs text-neutral-500">{notificationWhen(n)}</span>
          )}
        </span>
      ),
    },
    {
      key: "recipients",
      header: "Pessoas",
      numeric: true,
      cell: (n) =>
        n.recipientsCount === null ? (
          <span className="text-neutral-400">—</span>
        ) : (
          <span title={n.status === "sent" ? "Enviadas" : "Estimativa"}>
            {n.status === "sent" ? "" : "≈ "}
            {formatNumber(n.recipientsCount)}
          </span>
        ),
      className: "hidden lg:table-cell",
    },
    {
      key: "author",
      header: "Criada por",
      cell: (n) => <span className="text-neutral-600">{n.createdBy.name}</span>,
      className: "hidden xl:table-cell",
    },
  ];
}

export function NotificationsPage() {
  const { can } = useAuth();
  const [query, setQuery] = useUrlState(listNotificationsQuerySchema);
  const commit = useCallback((q: string) => setQuery({ q }, { replace: true }), [setQuery]);
  const [search, setSearch] = useSearchText(query.q, commit);
  const list = useNotifications(query);
  const [cancelling, setCancelling] = useState<PushNotification | null>(null);
  const canManage = can("notifications.manage");
  const filtered = Boolean(query.q || query.status);

  const columns = useMemo<Column<PushNotification>[]>(
    () => [
      ...baseColumns(),
      {
        key: "actions",
        header: <span className="sr-only">Ações</span>,
        numeric: true,
        cell: (n) => (
          <span className="inline-flex items-center gap-1">
            {canManage && n.status === "scheduled" && (
              <IconButton
                icon={CalendarX}
                label={`Cancelar o envio de ${n.title}`}
                variant="danger"
                size="sm"
                onClick={() => setCancelling(n)}
              />
            )}
            <Link
              to={PATHS.notification(n.id)}
              aria-label={`Abrir ${n.title}`}
              className="inline-grid size-8 place-items-center rounded-full text-neutral-400 hover:bg-neutral-900/[0.06] hover:text-neutral-900"
            >
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </span>
        ),
      },
    ],
    [canManage],
  );

  return (
    <>
      <PageHeader
        title="Notificações"
        description="Push para quem tem o app: rascunhos, agendadas e enviadas."
        actions={
          <Can permission="notifications.manage">
            <ButtonLink to={PATHS.notificationNew} icon={Plus}>
              Nova notificação
            </ButtonLink>
          </Can>
        }
      />
      <FilterBar>
        <Segmented
          label="Situação"
          size="sm"
          options={STATUS_OPTIONS}
          value={query.status ?? "all"}
          onChange={(v) => setQuery({ status: v === "all" ? undefined : v })}
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar pelo título"
          label="Buscar notificação"
          className="w-full sm:w-72"
        />
      </FilterBar>
      <Card>
        {list.error ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : (
          <>
            <Table
              caption="Notificações push"
              columns={columns}
              rows={list.data?.data}
              rowKey={(n) => n.id}
              loading={list.isLoading}
              empty={
                filtered ? (
                  <EmptyState
                    compact
                    icon={SearchX}
                    title="Nenhuma notificação com esses filtros"
                  />
                ) : (
                  <EmptyState
                    compact
                    icon={Bell}
                    title="Nenhuma notificação ainda"
                    description="Escreva a primeira: ela fica como rascunho até você enviar."
                    action={
                      <Can permission="notifications.manage">
                        <ButtonLink to={PATHS.notificationNew} icon={Plus}>
                          Nova notificação
                        </ButtonLink>
                      </Can>
                    }
                  />
                )
              }
            />
            {list.data && (
              <Pagination meta={list.data.meta} onPageChange={(page) => setQuery({ page })} />
            )}
          </>
        )}
      </Card>
      <CancelNotificationDialog notification={cancelling} onClose={() => setCancelling(null)} />
    </>
  );
}

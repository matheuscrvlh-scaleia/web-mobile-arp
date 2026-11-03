import type { Permission } from "@arp/contracts";
import type { ComponentType } from "react";
import { createBrowserRouter, type RouteObject } from "react-router";
import { GuestOnly, HomeRedirect, RequireAuth, RequirePermission } from "./guards";
import { AppShell } from "./layout/AppShell";
import { NotFoundPage } from "./pages/NotFoundPage";
import { RouteErrorPage } from "./pages/RouteErrorPage";
import { setPrefetchRoutes } from "./prefetch";

/**
 * Tela carregada sob demanda (um chunk por tela). O router espera o chunk
 * antes de trocar de tela; enquanto isso, a barrinha verde no topo.
 */
function page<M>(load: () => Promise<M>, pick: (m: M) => ComponentType) {
  return async () => ({ Component: pick(await load()) });
}

/** Grupo de rotas que exige a permissão da rota da API que as telas usam. */
const guarded = (permission: Permission, children: RouteObject[]): RouteObject => ({
  element: <RequirePermission permission={permission} />,
  children,
});

const routes: RouteObject[] = [
  {
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <GuestOnly />,
        children: [
          {
            path: "login",
            lazy: page(
              () => import("@/features/auth/pages/LoginPage"),
              (m) => m.LoginPage,
            ),
          },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            path: "trocar-senha",
            lazy: page(
              () => import("@/features/auth/pages/ChangePasswordPage"),
              (m) => m.ChangePasswordPage,
            ),
          },
          {
            element: <AppShell />,
            errorElement: <RouteErrorPage />,
            children: [
              { index: true, element: <HomeRedirect /> },

              guarded("dashboard.view", [
                {
                  path: "dashboard",
                  lazy: page(
                    () => import("@/features/dashboard/pages/DashboardPage"),
                    (m) => m.DashboardPage,
                  ),
                },
              ]),

              guarded("stores.view", [
                {
                  path: "lojas",
                  lazy: page(
                    () => import("@/features/stores/pages/StoresPage"),
                    (m) => m.StoresPage,
                  ),
                },
                {
                  path: "lojas/:id",
                  lazy: page(
                    () => import("@/features/stores/pages/StoreDetailPage"),
                    (m) => m.StoreDetailPage,
                  ),
                },
                {
                  path: "categorias",
                  lazy: page(
                    () => import("@/features/catalog/pages/CatalogPage"),
                    (m) => m.CatalogPage,
                  ),
                },
              ]),
              guarded("stores.manage", [
                {
                  path: "lojas/nova",
                  lazy: page(
                    () => import("@/features/stores/pages/StoreCreatePage"),
                    (m) => m.StoreCreatePage,
                  ),
                },
              ]),
              guarded("map.view", [
                {
                  path: "mapa",
                  lazy: page(
                    () => import("@/features/map/pages/MapPage"),
                    (m) => m.MapPage,
                  ),
                },
              ]),

              guarded("coupons.view", [
                {
                  path: "cupons",
                  lazy: page(
                    () => import("@/features/coupons/pages/CouponsPage"),
                    (m) => m.CouponsPage,
                  ),
                },
                {
                  path: "cupons/pegos",
                  lazy: page(
                    () => import("@/features/claims/pages/ClaimsPage"),
                    (m) => m.ClaimsPage,
                  ),
                },
                {
                  path: "cupons/:id",
                  lazy: page(
                    () => import("@/features/coupons/pages/CouponDetailPage"),
                    (m) => m.CouponDetailPage,
                  ),
                },
              ]),
              guarded("coupons.manage", [
                {
                  path: "cupons/nova",
                  lazy: page(
                    () => import("@/features/coupons/pages/CouponCreatePage"),
                    (m) => m.CouponCreatePage,
                  ),
                },
                {
                  path: "cupons/:id/editar",
                  lazy: page(
                    () => import("@/features/coupons/pages/CouponEditPage"),
                    (m) => m.CouponEditPage,
                  ),
                },
              ]),
              guarded("coupons.redeem", [
                {
                  path: "cupons/validar",
                  lazy: page(
                    () => import("@/features/claims/pages/RedeemPage"),
                    (m) => m.RedeemPage,
                  ),
                },
              ]),

              guarded("challenges.view", [
                {
                  path: "campanhas",
                  lazy: page(
                    () => import("@/features/campaigns/pages/CampaignsPage"),
                    (m) => m.CampaignsPage,
                  ),
                },
                {
                  path: "campanhas/:id",
                  lazy: page(
                    () => import("@/features/campaigns/pages/CampaignDetailPage"),
                    (m) => m.CampaignDetailPage,
                  ),
                },
                {
                  path: "desafios",
                  lazy: page(
                    () => import("@/features/challenges/pages/ChallengesPage"),
                    (m) => m.ChallengesPage,
                  ),
                },
                {
                  path: "desafios/:id",
                  lazy: page(
                    () => import("@/features/challenges/pages/ChallengeDetailPage"),
                    (m) => m.ChallengeDetailPage,
                  ),
                },
                {
                  path: "selos",
                  lazy: page(
                    () => import("@/features/seals/pages/SealsPage"),
                    (m) => m.SealsPage,
                  ),
                },
              ]),
              guarded("challenges.manage", [
                {
                  path: "campanhas/nova",
                  lazy: page(
                    () => import("@/features/campaigns/pages/CampaignCreatePage"),
                    (m) => m.CampaignCreatePage,
                  ),
                },
                {
                  path: "desafios/novo",
                  lazy: page(
                    () => import("@/features/challenges/pages/ChallengeCreatePage"),
                    (m) => m.ChallengeCreatePage,
                  ),
                },
              ]),

              guarded("events.view", [
                {
                  path: "eventos",
                  lazy: page(
                    () => import("@/features/events/pages/EventsPage"),
                    (m) => m.EventsPage,
                  ),
                },
                {
                  path: "eventos/:id",
                  lazy: page(
                    () => import("@/features/events/pages/EventDetailPage"),
                    (m) => m.EventDetailPage,
                  ),
                },
              ]),
              guarded("events.manage", [
                {
                  path: "eventos/novo",
                  lazy: page(
                    () => import("@/features/events/pages/EventCreatePage"),
                    (m) => m.EventCreatePage,
                  ),
                },
              ]),
              guarded("content.view", [
                {
                  path: "conteudo",
                  lazy: page(
                    () => import("@/features/content/pages/ContentPage"),
                    (m) => m.ContentPage,
                  ),
                },
              ]),
              guarded("jobs.view", [
                {
                  path: "vagas",
                  lazy: page(
                    () => import("@/features/content/pages/JobsPage"),
                    (m) => m.JobsPage,
                  ),
                },
              ]),
              guarded("highlights.view", [
                {
                  path: "destaques",
                  lazy: page(
                    () => import("@/features/highlights/pages/HighlightsPage"),
                    (m) => m.HighlightsPage,
                  ),
                },
                {
                  path: "destaques/:id",
                  lazy: page(
                    () => import("@/features/highlights/pages/HighlightDetailPage"),
                    (m) => m.HighlightDetailPage,
                  ),
                },
              ]),
              guarded("highlights.manage", [
                {
                  path: "destaques/novo",
                  lazy: page(
                    () => import("@/features/highlights/pages/HighlightCreatePage"),
                    (m) => m.HighlightCreatePage,
                  ),
                },
              ]),
              guarded("notifications.view", [
                {
                  path: "notificacoes",
                  lazy: page(
                    () => import("@/features/notifications/pages/NotificationsPage"),
                    (m) => m.NotificationsPage,
                  ),
                },
                {
                  path: "notificacoes/:id",
                  lazy: page(
                    () => import("@/features/notifications/pages/NotificationDetailPage"),
                    (m) => m.NotificationDetailPage,
                  ),
                },
              ]),
              guarded("notifications.manage", [
                {
                  path: "notificacoes/nova",
                  lazy: page(
                    () => import("@/features/notifications/pages/NotificationCreatePage"),
                    (m) => m.NotificationCreatePage,
                  ),
                },
              ]),
              guarded("visitors.view", [
                {
                  path: "visitantes",
                  lazy: page(
                    () => import("@/features/visitors/pages/VisitorsPage"),
                    (m) => m.VisitorsPage,
                  ),
                },
                {
                  path: "visitantes/:id",
                  lazy: page(
                    () => import("@/features/visitors/pages/VisitorDetailPage"),
                    (m) => m.VisitorDetailPage,
                  ),
                },
              ]),

              guarded("users.view", [
                {
                  path: "usuarios",
                  lazy: page(
                    () => import("@/features/users/pages/UsersPage"),
                    (m) => m.UsersPage,
                  ),
                },
                {
                  path: "usuarios/:id",
                  lazy: page(
                    () => import("@/features/users/pages/UserDetailPage"),
                    (m) => m.UserDetailPage,
                  ),
                },
                {
                  path: "cargos",
                  lazy: page(
                    () => import("@/features/roles/pages/RolesPage"),
                    (m) => m.RolesPage,
                  ),
                },
                {
                  path: "cargos/:id",
                  lazy: page(
                    () => import("@/features/roles/pages/RoleEditPage"),
                    (m) => m.RoleEditPage,
                  ),
                },
              ]),
              guarded("users.manage", [
                {
                  path: "usuarios/novo",
                  lazy: page(
                    () => import("@/features/users/pages/UserCreatePage"),
                    (m) => m.UserCreatePage,
                  ),
                },
                {
                  path: "cargos/novo",
                  lazy: page(
                    () => import("@/features/roles/pages/RoleEditPage"),
                    (m) => m.RoleEditPage,
                  ),
                },
              ]),
              guarded("audit.view", [
                {
                  path: "historico",
                  lazy: page(
                    () => import("@/features/audit/pages/AuditPage"),
                    (m) => m.AuditPage,
                  ),
                },
              ]),
              guarded("settings.manage", [
                {
                  path: "configuracoes",
                  lazy: page(
                    () => import("@/features/settings/pages/SettingsPage"),
                    (m) => m.SettingsPage,
                  ),
                },
              ]),

              { path: "*", element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
];

setPrefetchRoutes(routes);
export const router = createBrowserRouter(routes);

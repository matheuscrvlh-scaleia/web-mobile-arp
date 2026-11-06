import { type AuthUser, type Permission, ROUTES } from "@arp/contracts";
import {
  ArrowRightLeft,
  Award,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardCheck,
  Gift,
  History,
  Hourglass,
  LayoutDashboard,
  type LucideIcon,
  Map as MapIcon,
  Megaphone,
  Palette,
  Settings,
  Store,
  Tags,
  Target,
  TicketPercent,
  Trophy,
  UserPlus,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { PATHS } from "@/shared/config/paths";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Permissão da rota da API que a tela usa (de ROUTES); null = qualquer logado. */
  permission: Permission | null;
  /** Outras telas que também acendem este item (ex.: abas em rotas próprias). */
  also?: string[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

const item = (
  label: string,
  to: string,
  icon: LucideIcon,
  permission: Permission | null,
  also?: string[],
): NavItem => ({ label, to, icon, permission, ...(also && { also }) });

/** Menu completo da equipe da ARP. */
const STAFF_NAV: NavSection[] = [
  {
    title: "Gestão",
    items: [item("Dashboard", PATHS.dashboard, LayoutDashboard, ROUTES.dashboard.permission)],
  },
  {
    title: "Guia",
    items: [
      item("Lojas", PATHS.stores, Store, ROUTES.stores.list.permission),
      item("Mapa", PATHS.map(), MapIcon, ROUTES.floors.list.permission),
      item("Categorias e blocos", PATHS.catalog(), Tags, ROUTES.storeCategories.list.permission),
    ],
  },
  {
    title: "Cupons",
    items: [
      item("Promoções", PATHS.coupons, TicketPercent, ROUTES.coupons.list.permission),
      item(
        "Aprovar cupons",
        `${PATHS.coupons}?review=pending`,
        Hourglass,
        ROUTES.coupons.review.permission,
      ),
      item("Validar cupom", PATHS.redeem, ClipboardCheck, ROUTES.claims.redeem.permission),
      item("Cupons pegos", PATHS.claims, Wallet, ROUTES.claims.list.permission),
    ],
  },
  {
    title: "Selos",
    items: [
      item("Campanhas", PATHS.campaigns, Trophy, ROUTES.campaigns.list.permission),
      item("Desafios", PATHS.challenges, Target, ROUTES.challenges.list.permission),
      item("Selos", PATHS.seals, Award, ROUTES.seals.list.permission),
      item("Clube ARP", PATHS.club(), Gift, ROUTES.prizes.list.permission),
      item(
        "Trocar pontos",
        PATHS.prizeExchange,
        ArrowRightLeft,
        ROUTES.prizeRedemptions.create.permission,
      ),
      item("Relatórios", PATHS.reports, BarChart3, ROUTES.clubReports.coupons.permission),
    ],
  },
  {
    title: "Agenda",
    items: [item("Eventos", PATHS.events, CalendarDays, ROUTES.events.list.permission)],
  },
  {
    title: "Comunicação",
    items: [
      item("Destaques", PATHS.highlights, Megaphone, ROUTES.highlights.list.permission),
      item("Notificações", PATHS.notifications, Bell, ROUTES.notifications.list.permission),
    ],
  },
  {
    title: "Conteúdo",
    items: [
      item(
        "Textos, Circuito e Sustentarp",
        PATHS.content(),
        Palette,
        ROUTES.contentPages.list.permission,
      ),
      item("Vagas", PATHS.jobs, BriefcaseBusiness, ROUTES.jobs.list.permission),
    ],
  },
  {
    title: "Visitantes",
    items: [item("Visitantes", PATHS.visitors, UserRound, ROUTES.visitors.list.permission)],
  },
  {
    title: "Administração",
    items: [
      item("Usuários e cargos", PATHS.users, Users, ROUTES.users.list.permission, [PATHS.roles]),
      item("Lojistas", PATHS.merchants, UserPlus, ROUTES.merchantSignups.list.permission),
      item("Histórico", PATHS.audit, History, ROUTES.auditLogs.permission),
      item("Configurações", PATHS.settings, Settings, ROUTES.settings.get.permission),
    ],
  },
];

/** Menu enxuto do lojista: a loja dele em primeiro lugar. */
function merchantNav(storeId: string): NavSection[] {
  return [
    {
      title: "Minha loja",
      // Um item só: Dados, Horários e Desempenho são abas da própria tela.
      // Abre em Desempenho (sem permissão, a tela cai em Dados); `also` acende em qualquer aba.
      items: [
        item(
          "Minha loja",
          PATHS.store(storeId, "desempenho"),
          Store,
          ROUTES.stores.get.permission,
          [PATHS.store(storeId)],
        ),
      ],
    },
    {
      title: "Cupons",
      items: [
        item("Validar cupom", PATHS.redeem, ClipboardCheck, ROUTES.claims.redeem.permission),
        item("Promoções", PATHS.coupons, TicketPercent, ROUTES.coupons.list.permission),
        item("Cupons pegos", PATHS.claims, Wallet, ROUTES.claims.list.permission),
      ],
    },
    {
      title: "Vagas",
      items: [item("Vagas", PATHS.jobs, BriefcaseBusiness, ROUTES.jobs.list.permission)],
    },
  ];
}

/** Seções que a pessoa pode ver (só itens com permissão; seção vazia some). */
export function navigationFor(user: AuthUser): NavSection[] {
  const perms = new Set(user.permissions);
  const base = user.store ? merchantNav(user.store.id) : STAFF_NAV;
  return base
    .map((s) => ({
      ...s,
      items: s.items.filter((i) => i.permission === null || perms.has(i.permission)),
    }))
    .filter((s) => s.items.length > 0);
}

/** Primeira tela depois do login: a primeira do menu da pessoa. */
export function homePathFor(user: AuthUser): string | null {
  return navigationFor(user)[0]?.items[0]?.to ?? null;
}

/** Item do menu da tela atual: o de caminho mais longo que casa com a URL. */
export function activeNavItem(
  sections: NavSection[],
  pathname: string,
  search: string,
): { section: NavSection; item: NavItem } | null {
  let best: { section: NavSection; item: NavItem; score: number } | null = null;
  for (const section of sections) {
    for (const it of section.items) {
      for (const to of [it.to, ...(it.also ?? [])]) {
        const [path, query] = to.split("?");
        if (!path) continue;
        const matchesPath = pathname === path || pathname.startsWith(`${path}/`);
        if (!matchesPath) continue;
        // Itens com query (ex.: ?aba=desempenho) só ganham quando a query casa.
        const matchesQuery = !query || search.includes(query);
        const score =
          path.length + (query && matchesQuery ? 1000 : 0) - (query && !matchesQuery ? 2000 : 0);
        if (!best || score > best.score) best = { section, item: it, score };
      }
    }
  }
  return best && best.score > 0 ? { section: best.section, item: best.item } : null;
}

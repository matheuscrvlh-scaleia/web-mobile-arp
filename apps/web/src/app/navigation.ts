import { type AuthUser, type PendingKind, type Permission, ROUTES } from "@arp/contracts";
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
  Plug,
  Settings,
  Store,
  Tags,
  TicketPercent,
  Trophy,
  UserPlus,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { PATHS } from "@/shared/config/paths";
import { normalize } from "@/shared/lib/text";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Permissão da rota da API que a tela usa (de ROUTES); null = qualquer logado. */
  permission: Permission | null;
  /** Outras telas que também acendem este item (ex.: abas em rotas próprias). */
  also?: string[];
  /** Outras palavras que acham a tela na busca (Ctrl+K): sinônimos, nome antigo. */
  keywords?: string[];
  /** Contador de pendências ao lado do nome (ex.: cupons para aprovar). */
  badge?: PendingKind;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

type ItemExtras = Pick<NavItem, "also" | "keywords" | "badge">;

const item = (
  label: string,
  to: string,
  icon: LucideIcon,
  permission: Permission | null,
  extras: ItemExtras = {},
): NavItem => ({ label, to, icon, permission, ...extras });

/*
 * Menu da equipe da ARP, agrupado pela tarefa (o h1 de cada tela é o rótulo
 * do item). Balcão vem logo depois do Início: para quem só atende (sem
 * Dashboard), é a primeira tela depois do login.
 */
const STAFF_NAV: NavSection[] = [
  {
    title: "Início",
    items: [
      item("Dashboard", PATHS.dashboard, LayoutDashboard, ROUTES.dashboard.permission, {
        keywords: ["início", "inicio", "painel", "indicadores", "pendências", "resumo"],
      }),
    ],
  },
  {
    title: "Balcão",
    items: [
      item("Validar cupom", PATHS.redeem, ClipboardCheck, ROUTES.claims.redeem.permission, {
        keywords: ["caixa", "código", "qr", "usar cupom", "baixa"],
      }),
      item(
        "Trocar pontos",
        PATHS.prizeExchange,
        ArrowRightLeft,
        ROUTES.prizeRedemptions.create.permission,
        {
          keywords: [
            "trocar prêmio",
            "validar troca",
            "entregar prêmio",
            "troca",
            "pontos",
            "clube",
            "brinde",
            "desfazer troca",
          ],
        },
      ),
    ],
  },
  {
    title: "Lojas",
    items: [
      item("Lojas", PATHS.stores, Store, ROUTES.stores.list.permission, {
        keywords: ["guia", "loja", "restaurante", "alimentação", "horário"],
      }),
      item("Mapa", PATHS.map(), MapIcon, ROUTES.floors.list.permission, {
        keywords: ["andar", "planta", "referência", "localização"],
      }),
      item("Categorias e blocos", PATHS.catalog(), Tags, ROUTES.storeCategories.list.permission, {
        keywords: ["categoria", "bloco", "segmento"],
      }),
      item("Lojistas", PATHS.merchants, UserPlus, ROUTES.merchantSignups.list.permission, {
        keywords: ["cadastro de lojista", "link de cadastro", "aprovar lojista", "parceiro"],
        badge: "merchantSignups",
      }),
    ],
  },
  {
    title: "Promoções",
    items: [
      item("Promoções", PATHS.coupons, TicketPercent, ROUTES.coupons.list.permission, {
        keywords: ["cupom", "oferta", "desconto", "estoque"],
      }),
      item(
        "Aprovar cupons",
        `${PATHS.coupons}?review=pending`,
        Hourglass,
        ROUTES.coupons.review.permission,
        { keywords: ["revisão", "aprovação", "aguardando", "lojista"], badge: "couponsToReview" },
      ),
      item("Cupons pegos", PATHS.claims, Wallet, ROUTES.claims.list.permission, {
        keywords: ["cupom", "resgate", "usados", "código"],
      }),
    ],
  },
  {
    title: "Selos",
    items: [
      // Os desafios são uma aba da campanha; /desafios continua acendendo aqui.
      item("Campanhas", PATHS.campaigns, Trophy, ROUTES.campaigns.list.permission, {
        also: [PATHS.challenges],
        keywords: ["desafio", "qr", "missão", "mês", "faixa", "recompensa"],
      }),
      item("Selos", PATHS.seals, Award, ROUTES.seals.list.permission, {
        keywords: ["selo", "conquista", "medalha", "conquistados"],
      }),
    ],
  },
  {
    title: "Clube ARP",
    items: [
      item("Clube ARP", PATHS.club(), Gift, ROUTES.prizes.list.permission, {
        keywords: ["pontos", "prêmio", "lojinha", "trocas", "ranking", "fidelidade"],
      }),
    ],
  },
  {
    title: "Comunicação",
    items: [
      item("Destaques", PATHS.highlights, Megaphone, ROUTES.highlights.list.permission, {
        keywords: ["banner", "carrossel", "patrocinado", "home do app", "vitrine"],
      }),
      item("Notificações", PATHS.notifications, Bell, ROUTES.notifications.list.permission, {
        keywords: ["push", "aviso", "mensagem", "disparo", "enviar"],
      }),
      item("Eventos", PATHS.events, CalendarDays, ROUTES.events.list.permission, {
        keywords: ["agenda", "show", "calendário", "programação"],
      }),
    ],
  },
  {
    title: "Conteúdo",
    items: [
      item("Conteúdo do app", PATHS.content(), Palette, ROUTES.contentPages.list.permission, {
        keywords: [
          "textos",
          "circuito",
          "sustentarp",
          "regulamento",
          "regras",
          "história",
          "reciclagem",
          "arte",
        ],
      }),
      item("Vagas", PATHS.jobs, BriefcaseBusiness, ROUTES.jobs.list.permission, {
        keywords: ["emprego", "trabalhe conosco", "currículo"],
      }),
    ],
  },
  {
    title: "Pessoas",
    items: [
      item("Usuários do app", PATHS.visitors, UserRound, ROUTES.visitors.list.permission, {
        keywords: ["visitante", "cliente", "conta do app", "bloquear", "lgpd", "anonimizar"],
      }),
    ],
  },
  {
    title: "Sistema",
    items: [
      item("Relatórios", PATHS.reports, BarChart3, ROUTES.clubReports.coupons.permission, {
        keywords: ["relatório", "cobrança", "cupons por loja", "selos por loja", "exportar"],
      }),
      item("Histórico", PATHS.audit, History, ROUTES.auditLogs.permission, {
        keywords: ["auditoria", "log", "quem alterou", "alterações"],
      }),
      item("Usuários e cargos", PATHS.users, Users, ROUTES.users.list.permission, {
        also: [PATHS.roles],
        keywords: ["equipe", "acesso", "permissão", "senha", "cargo", "login"],
      }),
      item("Integrações", PATHS.integrations, Plug, ROUTES.events.syncSite.permission, {
        keywords: ["site", "wordpress", "sincronizar", "importar", "espacoarp", "agenda"],
      }),
      item("Configurações", PATHS.settings, Settings, ROUTES.settings.get.permission, {
        keywords: [
          "ajustes",
          "suporte",
          "contato",
          "whatsapp",
          "validade dos pontos",
          "prazo padrão",
          "estacionamento",
          "tour",
          "sobre a arp",
          "termos",
          "privacidade",
        ],
      }),
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
          {
            also: [PATHS.store(storeId)],
            keywords: ["loja", "horário", "desempenho", "dados"],
          },
        ),
      ],
    },
    {
      title: "Balcão",
      items: [
        item("Validar cupom", PATHS.redeem, ClipboardCheck, ROUTES.claims.redeem.permission, {
          keywords: ["caixa", "código", "qr"],
        }),
      ],
    },
    {
      title: "Promoções",
      items: [
        item("Promoções", PATHS.coupons, TicketPercent, ROUTES.coupons.list.permission, {
          keywords: ["cupom", "oferta", "desconto"],
        }),
        item("Cupons pegos", PATHS.claims, Wallet, ROUTES.claims.list.permission, {
          keywords: ["cupom", "usados", "código"],
        }),
      ],
    },
    {
      title: "Vagas",
      items: [
        item("Vagas", PATHS.jobs, BriefcaseBusiness, ROUTES.jobs.list.permission, {
          keywords: ["emprego", "currículo"],
        }),
      ],
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

/**
 * Telas do menu da equipe que cada permissão libera ("Libera: Lojas, Mapa"),
 * para a tela de cargos falar a língua do menu.
 */
export function screensByPermission(): Map<Permission, string[]> {
  const map = new Map<Permission, string[]>();
  for (const section of STAFF_NAV) {
    for (const it of section.items) {
      if (!it.permission) continue;
      map.set(it.permission, [...(map.get(it.permission) ?? []), it.label]);
    }
  }
  return map;
}

/** Rótulo do menu da tela que usa a permissão (ex.: tela de acesso negado). */
export function screenOfPermission(permission: Permission): string | null {
  return screensByPermission().get(permission)?.[0] ?? null;
}

/* Busca de telas (Ctrl+K) ------------------------------------------------- */

/** Palavra sem acento e sem plural simples ("promoções" → "promoco", "cupons" → "cupom"). */
function stem(word: string): string {
  let w = normalize(word);
  if (w.length > 4 && w.endsWith("oes")) w = `${w.slice(0, -3)}ao`;
  else if (w.length > 4 && w.endsWith("aes")) w = `${w.slice(0, -3)}ao`;
  else if (w.length > 3 && w.endsWith("ns")) w = `${w.slice(0, -2)}m`;
  else if (w.length > 4 && /[rsz]es$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("is")) w = `${w.slice(0, -2)}l`;
  else if (w.length > 3 && w.endsWith("s")) w = w.slice(0, -1);
  return w;
}

const words = (text: string) =>
  text
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map(stem);

/**
 * A tela casa quando cada palavra digitada começa alguma palavra do rótulo,
 * da seção ou das palavras-chave (sem acento e sem plural). Rótulo pesa mais.
 */
export function searchScreens<T extends NavItem & { section: string }>(
  all: T[],
  term: string,
): T[] {
  const typed = words(term);
  if (typed.length === 0) return all;
  const scored: { it: T; score: number }[] = [];
  for (const it of all) {
    const label = words(it.label);
    const rest = words([it.section, ...(it.keywords ?? [])].join(" "));
    let score = 0;
    for (const t of typed) {
      if (label.some((w) => w.startsWith(t))) score += 2;
      else if (rest.some((w) => w.startsWith(t))) score += 1;
      else {
        score = -1;
        break;
      }
    }
    if (score > 0) scored.push({ it, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.it);
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

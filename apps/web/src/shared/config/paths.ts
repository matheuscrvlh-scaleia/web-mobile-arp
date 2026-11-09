// Endereços das telas do painel (em pt-BR, como o copiloto). Um lugar só:
// links entre features usam estas funções, nunca strings soltas.

export const PATHS = {
  home: "/",
  login: "/login",
  changePassword: "/trocar-senha",
  account: "/minha-conta",

  dashboard: "/dashboard",

  stores: "/lojas",
  storeNew: "/lojas/nova",
  store: (id: string, tab?: StoreTab) =>
    `/lojas/${id}${tab && tab !== "dados" ? `?aba=${tab}` : ""}`,
  map: (floorId?: string) => (floorId ? `/mapa?andar=${floorId}` : "/mapa"),
  catalog: (tab?: "categorias" | "blocos") =>
    tab === "blocos" ? "/categorias?aba=blocos" : "/categorias",

  content: (tab?: "textos" | "circuito" | "sustentarp") =>
    tab && tab !== "textos" ? `/conteudo?aba=${tab}` : "/conteudo",
  jobs: "/vagas",

  coupons: "/cupons",
  couponNew: "/cupons/nova",
  coupon: (id: string) => `/cupons/${id}`,
  couponEdit: (id: string) => `/cupons/${id}/editar`,
  redeem: "/cupons/validar",
  /** Validar já com o código preenchido (ação "Validar" em Cupons pegos). */
  redeemCode: (code: string) => `/cupons/validar${toQuery({ codigo: code })}`,
  claims: "/cupons/pegos",
  /** Cupons pegos já filtrados (por promoção, loja, visitante ou situação). */
  claimsWith: (filters: ClaimFilters) => `/cupons/pegos${toQuery(filters)}`,

  campaigns: "/campanhas",
  campaignNew: "/campanhas/nova",
  campaign: (id: string, tab?: CampaignTab) =>
    `/campanhas/${id}${tab && tab !== "resumo" ? `?aba=${tab}` : ""}`,
  challenges: "/desafios",
  /** Desafios de uma campanha (seletor da lista). */
  challengesOf: (campaignId: string) => `/desafios${toQuery({ campaignId })}`,
  /** `de` = duplicar este desafio (o formulário vem preenchido). */
  challengeNew: (campaignId?: string, de?: string) =>
    `/desafios/novo${toQuery({ campaignId, de })}`,
  challenge: (id: string) => `/desafios/${id}`,
  /** QR em modo telão, em tela cheia (abre em outra aba). */
  qrScreen: (id: string) => `/telao/${id}`,
  reports: "/relatorios",
  merchants: "/lojistas",
  club: (tab?: "lojinha" | "trocas" | "ranking" | "selos") =>
    `/clube${tab && tab !== "lojinha" ? `?aba=${tab}` : ""}`,
  /** Troca de pontos por prêmio no balcão. */
  prizeExchange: "/clube/trocar",
  seals: "/selos",
  /** Aba "Conquistados" dos selos, com filtros. */
  earnedSeals: (filters: EarnedSealFilters = {}) =>
    `/selos${toQuery({ aba: "conquistados", ...filters })}`,

  events: "/eventos",
  eventsTab: (tab: EventsTab) => (tab === "lista" ? "/eventos" : `/eventos?aba=${tab}`),
  event: (id: string) => `/eventos/${id}`,
  highlights: "/destaques",
  highlightNew: "/destaques/novo",
  highlight: (id: string) => `/destaques/${id}`,
  notifications: "/notificacoes",
  notificationNew: "/notificacoes/nova",
  notification: (id: string) => `/notificacoes/${id}`,
  visitors: "/visitantes",
  visitor: (id: string) => `/visitantes/${id}`,

  users: "/usuarios",
  userNew: "/usuarios/novo",
  user: (id: string) => `/usuarios/${id}`,
  roles: "/cargos",
  roleNew: "/cargos/novo",
  role: (id: string) => `/cargos/${id}`,
  audit: "/historico",
  settings: "/configuracoes",
  integrations: "/integracoes",
} as const;

export type StoreTab = "dados" | "horarios" | "localizacao" | "equipe" | "desempenho";
export const STORE_TABS: readonly StoreTab[] = [
  "dados",
  "horarios",
  "localizacao",
  "equipe",
  "desempenho",
];

export type ClaimFilters = {
  couponId?: string;
  storeId?: string;
  visitorId?: string;
  status?: string;
};

export type EarnedSealFilters = {
  campaignId?: string;
  challengeId?: string;
  visitorId?: string;
};

export type CampaignTab = "resumo" | "desafios" | "faixas" | "dados";
export const CAMPAIGN_TABS: readonly CampaignTab[] = ["resumo", "desafios", "faixas", "dados"];

export type EventsTab = "lista" | "calendario" | "categorias";
export const EVENTS_TABS: readonly EventsTab[] = ["lista", "calendario", "categorias"];

/** Query string só com os valores preenchidos ("" quando não sobra nenhum). */
function toQuery(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

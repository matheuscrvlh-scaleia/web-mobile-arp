// Endereços das telas do painel (em pt-BR, como o copiloto). Um lugar só:
// links entre features usam estas funções, nunca strings soltas.

export const PATHS = {
  home: "/",
  login: "/login",
  changePassword: "/trocar-senha",

  dashboard: "/dashboard",

  stores: "/lojas",
  storeNew: "/lojas/nova",
  store: (id: string, tab?: StoreTab) =>
    `/lojas/${id}${tab && tab !== "dados" ? `?aba=${tab}` : ""}`,
  map: (floorId?: string) => (floorId ? `/mapa?andar=${floorId}` : "/mapa"),
  catalog: (tab?: "categorias" | "blocos") =>
    tab === "blocos" ? "/categorias?aba=blocos" : "/categorias",

  coupons: "/cupons",
  couponNew: "/cupons/nova",
  coupon: (id: string) => `/cupons/${id}`,
  couponEdit: (id: string) => `/cupons/${id}/editar`,
  redeem: "/cupons/validar",
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
  challengeNew: (campaignId?: string) => `/desafios/novo${toQuery({ campaignId })}`,
  challenge: (id: string) => `/desafios/${id}`,
  seals: "/selos",
  /** Aba "Conquistados" dos selos, com filtros. */
  earnedSeals: (filters: EarnedSealFilters = {}) =>
    `/selos${toQuery({ aba: "conquistados", ...filters })}`,

  events: "/eventos",
  eventsTab: (tab: EventsTab) => (tab === "lista" ? "/eventos" : `/eventos?aba=${tab}`),
  eventNew: "/eventos/novo",
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
} as const;

export type StoreTab = "dados" | "horarios" | "localizacao" | "desempenho";
export const STORE_TABS: readonly StoreTab[] = ["dados", "horarios", "localizacao", "desempenho"];

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

export type CampaignTab = "resumo" | "faixas" | "dados";
export const CAMPAIGN_TABS: readonly CampaignTab[] = ["resumo", "faixas", "dados"];

export type EventsTab = "lista" | "calendario" | "categorias";
export const EVENTS_TABS: readonly EventsTab[] = ["lista", "calendario", "categorias"];

/** Query string só com os valores preenchidos ("" quando não sobra nenhum). */
function toQuery(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

import type { Permission } from "./permissions";

/**
 * Catálogo das rotas do painel (prefixo /api/v1). É o contrato entre a API
 * e o web: a API registra exatamente estas rotas (com o schema de cada uma
 * vindo deste pacote) e o web chama por aqui. `permission: null` = qualquer
 * usuário logado; `public: true` = sem login.
 *
 * Respostas das escritas: POST de criação → 201 com o DTO completo do
 * recurso (o mesmo do GET /:id ou do item da lista); PATCH/PUT e ações
 * (status, schedule, cancel, redeem) → 200 com o DTO atualizado; DELETE,
 * logout, change-password e reorder → 204 sem corpo.
 *
 * Lojista (usuário com loja): a API restringe a leitura e as ações à loja
 * dele mesmo quando o filtro não é enviado.
 */
export interface RouteDef {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  permission: Permission | null;
  public?: true;
  summary: string;
}

export const API_PREFIX = "/api/v1";

const r = (
  method: RouteDef["method"],
  path: string,
  permission: Permission | null,
  summary: string,
  extra: Partial<Pick<RouteDef, "public">> = {},
): RouteDef => ({ method, path, permission, summary, ...extra });

export const ROUTES = {
  health: r("GET", "/health", null, "Saúde da API e dependências", { public: true }),

  auth: {
    login: r("POST", "/auth/login", null, "Entrar (e-mail e senha)", { public: true }),
    refresh: r("POST", "/auth/refresh", null, "Renovar sessão (cookie)", { public: true }),
    logout: r("POST", "/auth/logout", null, "Sair (revoga o refresh)", { public: true }),
    me: r("GET", "/auth/me", null, "Usuário logado"),
    changePassword: r("POST", "/auth/change-password", null, "Trocar a própria senha"),
  },

  permissions: r("GET", "/permissions", "users.view", "Catálogo de permissões"),
  roles: {
    list: r("GET", "/roles", "users.view", "Cargos"),
    create: r("POST", "/roles", "users.manage", "Criar cargo"),
    update: r("PATCH", "/roles/:id", "users.manage", "Editar cargo"),
    remove: r("DELETE", "/roles/:id", "users.manage", "Apagar cargo sem usuários"),
  },
  users: {
    list: r("GET", "/users", "users.view", "Usuários do painel"),
    get: r("GET", "/users/:id", "users.view", "Usuário"),
    create: r("POST", "/users", "users.manage", "Criar usuário"),
    update: r("PATCH", "/users/:id", "users.manage", "Editar / desativar usuário"),
    remove: r("DELETE", "/users/:id", "users.manage", "Excluir usuário sem histórico"),
    resetPassword: r("POST", "/users/:id/reset-password", "users.manage", "Gerar senha provisória"),
  },

  floors: {
    list: r("GET", "/floors", "map.view", "Andares com desenho do mapa"),
    pins: r("GET", "/floors/:id/pins", "map.view", "Todas as lojas do andar para o mapa"),
    create: r("POST", "/floors", "map.manage", "Criar andar"),
    update: r("PATCH", "/floors/:id", "map.manage", "Editar andar / desenho"),
    remove: r("DELETE", "/floors/:id", "map.manage", "Apagar andar sem lojas"),
  },
  blocks: {
    list: r("GET", "/blocks", "map.view", "Blocos"),
    create: r("POST", "/blocks", "map.manage", "Criar bloco"),
    update: r("PATCH", "/blocks/:id", "map.manage", "Editar bloco"),
    remove: r("DELETE", "/blocks/:id", "map.manage", "Apagar bloco sem lojas"),
  },
  mapPoints: {
    list: r("GET", "/map-points", "map.view", "Pontos de referência (?floorId)"),
    create: r("POST", "/map-points", "map.manage", "Criar ponto"),
    update: r("PATCH", "/map-points/:id", "map.manage", "Editar ponto"),
    remove: r("DELETE", "/map-points/:id", "map.manage", "Apagar ponto"),
  },
  storeCategories: {
    list: r("GET", "/store-categories", "stores.view", "Categorias de loja"),
    create: r("POST", "/store-categories", "stores.manage", "Criar categoria"),
    update: r("PATCH", "/store-categories/:id", "stores.manage", "Editar categoria"),
    remove: r("DELETE", "/store-categories/:id", "stores.manage", "Apagar categoria sem lojas"),
  },
  stores: {
    list: r("GET", "/stores", "stores.view", "Lojas (paginado, filtros)"),
    options: r("GET", "/stores/options", null, "Lojas ativas para selects"),
    get: r("GET", "/stores/:id", "stores.view", "Loja com horários"),
    create: r("POST", "/stores", "stores.manage", "Criar loja"),
    update: r("PATCH", "/stores/:id", "stores.manage", "Editar loja (inclui horários)"),
    updateLocation: r("PUT", "/stores/:id/location", "map.manage", "Posicionar loja no mapa"),
    remove: r("DELETE", "/stores/:id", "stores.manage", "Desativar loja"),
    metrics: r("GET", "/stores/:id/metrics", "coupons.view", "Painel do lojista"),
  },

  coupons: {
    list: r("GET", "/coupons", "coupons.view", "Promoções (paginado, filtros)"),
    get: r("GET", "/coupons/:id", "coupons.view", "Promoção com estoque"),
    create: r("POST", "/coupons", "coupons.manage", "Criar promoção"),
    update: r("PATCH", "/coupons/:id", "coupons.manage", "Editar promoção"),
    changeStatus: r("POST", "/coupons/:id/status", "coupons.manage", "Ativar, pausar ou encerrar"),
  },
  claims: {
    list: r("GET", "/coupon-claims", "coupons.view", "Cupons pegos (paginado, filtros)"),
    lookup: r("GET", "/coupon-claims/lookup", "coupons.redeem", "Consultar código (?code)"),
    redeem: r("POST", "/coupon-claims/redeem", "coupons.redeem", "Validar código no caixa"),
  },

  seals: {
    list: r("GET", "/seals", "challenges.view", "Selos"),
    create: r("POST", "/seals", "challenges.manage", "Criar selo"),
    update: r("PATCH", "/seals/:id", "challenges.manage", "Editar / arquivar selo"),
  },
  campaigns: {
    list: r("GET", "/campaigns", "challenges.view", "Campanhas com faixas"),
    get: r("GET", "/campaigns/:id", "challenges.view", "Campanha"),
    create: r("POST", "/campaigns", "challenges.manage", "Criar campanha"),
    update: r("PATCH", "/campaigns/:id", "challenges.manage", "Editar / publicar campanha"),
    replaceTiers: r("PUT", "/campaigns/:id/tiers", "challenges.manage", "Faixas de benefício"),
  },
  challenges: {
    list: r("GET", "/challenges", "challenges.view", "Desafios (?campaignId)"),
    get: r("GET", "/challenges/:id", "challenges.view", "Desafio"),
    create: r("POST", "/challenges", "challenges.manage", "Criar desafio"),
    update: r("PATCH", "/challenges/:id", "challenges.manage", "Editar desafio"),
    remove: r("DELETE", "/challenges/:id", "challenges.manage", "Apagar desafio sem selos dados"),
  },
  qrCodes: {
    list: r("GET", "/challenges/:id/qr-codes", "challenges.view", "QR Codes do desafio"),
    create: r("POST", "/challenges/:id/qr-codes", "challenges.manage", "Gerar QR Code"),
    update: r("PATCH", "/qr-codes/:id", "challenges.manage", "Editar / revogar QR Code"),
  },
  earnedSeals: {
    list: r("GET", "/earned-seals", "challenges.view", "Selos conquistados (paginado)"),
  },

  eventCategories: {
    list: r("GET", "/event-categories", "events.view", "Categorias de evento"),
    create: r("POST", "/event-categories", "events.manage", "Criar categoria"),
    update: r("PATCH", "/event-categories/:id", "events.manage", "Editar categoria"),
    remove: r("DELETE", "/event-categories/:id", "events.manage", "Apagar categoria sem eventos"),
  },
  events: {
    list: r("GET", "/events", "events.view", "Eventos (paginado, filtros)"),
    occurrences: r("GET", "/events/occurrences", "events.view", "Calendário (?from&to)"),
    get: r("GET", "/events/:id", "events.view", "Evento"),
    create: r("POST", "/events", "events.manage", "Criar evento"),
    update: r("PATCH", "/events/:id", "events.manage", "Editar / publicar / cancelar evento"),
    remove: r("DELETE", "/events/:id", "events.manage", "Apagar rascunho"),
  },

  highlights: {
    list: r("GET", "/highlights", "highlights.view", "Destaques na ordem do carrossel"),
    get: r("GET", "/highlights/:id", "highlights.view", "Destaque"),
    create: r("POST", "/highlights", "highlights.manage", "Criar destaque"),
    update: r("PATCH", "/highlights/:id", "highlights.manage", "Editar destaque"),
    reorder: r("PUT", "/highlights/order", "highlights.manage", "Reordenar carrossel"),
    remove: r("DELETE", "/highlights/:id", "highlights.manage", "Apagar destaque"),
  },
  notifications: {
    list: r("GET", "/notifications", "notifications.view", "Notificações (paginado)"),
    estimate: r("GET", "/notifications/estimate", "notifications.view", "Estimar público"),
    get: r("GET", "/notifications/:id", "notifications.view", "Notificação"),
    create: r("POST", "/notifications", "notifications.manage", "Criar rascunho"),
    update: r("PATCH", "/notifications/:id", "notifications.manage", "Editar rascunho"),
    schedule: r("POST", "/notifications/:id/schedule", "notifications.manage", "Agendar / enviar"),
    cancel: r("POST", "/notifications/:id/cancel", "notifications.manage", "Cancelar agendada"),
  },

  /* Conteúdo (Fase 2): textos, Circuito Cultural, Sustentarp e vagas. */
  contentPages: {
    list: r("GET", "/content/pages", "content.view", "Textos da ARP"),
    update: r("PATCH", "/content/pages/:key", "content.manage", "Editar texto"),
  },
  artPoints: {
    list: r("GET", "/content/art-points", "content.view", "Pontos do Circuito Cultural"),
    create: r("POST", "/content/art-points", "content.manage", "Criar ponto do Circuito"),
    update: r("PATCH", "/content/art-points/:id", "content.manage", "Editar ponto do Circuito"),
    remove: r("DELETE", "/content/art-points/:id", "content.manage", "Apagar ponto do Circuito"),
  },
  recyclingItems: {
    list: r("GET", "/content/recycling-items", "content.view", "Itens do Sustentarp"),
    create: r("POST", "/content/recycling-items", "content.manage", "Criar item do Sustentarp"),
    update: r("PATCH", "/content/recycling-items/:id", "content.manage", "Editar item"),
    remove: r("DELETE", "/content/recycling-items/:id", "content.manage", "Apagar item"),
  },
  jobs: {
    list: r("GET", "/jobs", "jobs.view", "Vagas (?storeId&status)"),
    create: r("POST", "/jobs", "jobs.manage", "Publicar vaga"),
    remove: r("DELETE", "/jobs/:id", "jobs.manage", "Tirar vaga do ar"),
  },

  visitors: {
    list: r("GET", "/visitors", "visitors.view", "Visitantes (paginado, filtros)"),
    get: r("GET", "/visitors/:id", "visitors.view", "Visitante com histórico"),
    updateStatus: r("PATCH", "/visitors/:id/status", "visitors.manage", "Bloquear / desbloquear"),
  },

  dashboard: r("GET", "/dashboard/overview", "dashboard.view", "Indicadores do período"),
  auditLogs: r("GET", "/audit-logs", "audit.view", "Histórico de alterações"),
  settings: {
    get: r("GET", "/settings", "settings.manage", "Configurações do app"),
    update: r("PATCH", "/settings", "settings.manage", "Salvar configurações"),
  },
  uploads: r("POST", "/uploads", null, "Enviar imagem (multipart, campo file)"),
} as const;

/** Troca :param pelos valores (ex.: path("/stores/:id", { id })). */
export function path(template: string, params: Record<string, string> = {}): string {
  return template.replace(/:([a-zA-Z]+)/g, (_, k: string) => {
    const v = params[k];
    if (v === undefined) throw new Error(`Parâmetro ausente: ${k}`);
    return encodeURIComponent(v);
  });
}

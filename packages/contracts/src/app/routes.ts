/**
 * Catálogo das rotas do app do visitante (prefixo /api/v1/app). Mesmo
 * formato de ROUTES do painel, sem permissões: `public: true` = sem login
 * (navegação livre; com um Bearer válido do app a resposta é personalizada,
 * ex.: isFavorite); as demais exigem o access token do app.
 *
 * Respostas: criação → 201; ações e leituras → 200; marcar/desmarcar,
 * logout, push token e métricas de destaque → 204 sem corpo.
 */
export interface AppRouteDef {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  permission: null;
  public?: true;
  summary: string;
}

export const APP_API_PREFIX = "/api/v1/app";

const r = (
  method: AppRouteDef["method"],
  path: string,
  summary: string,
  extra: { public?: true } = {},
): AppRouteDef => ({ method, path, permission: null, summary, ...extra });

const open = { public: true } as const;

export const APP_ROUTES = {
  auth: {
    register: r("POST", "/auth/register", "Criar conta de visitante", open),
    login: r("POST", "/auth/login", "Entrar (e-mail e senha)", open),
    social: r("POST", "/auth/social", "Entrar com Google ou Apple (id_token)", open),
    forgotPassword: r("POST", "/auth/password/forgot", "Pedir código para nova senha", open),
    resetPassword: r("POST", "/auth/password/reset", "Criar nova senha com o código", open),
    refresh: r("POST", "/auth/refresh", "Renovar sessão (refresh no corpo)", open),
    logout: r("POST", "/auth/logout", "Sair (revoga o refresh e desvincula o push)", open),
  },
  me: {
    get: r("GET", "/me", "Perfil e resumo do mês"),
    update: r("PATCH", "/me", "Editar perfil e aceite de comunicação"),
    favorites: r("GET", "/me/favorites", "Lojas favoritas"),
    wallet: r("GET", "/me/wallet", "Carteira de cupons (?tab=active|used|expired)"),
    claim: r("GET", "/me/claims/:id", "Cupom pego (situação atual: usado, vencido...)"),
  },
  home: r("GET", "/home", "Home: destaques, cupons acabando, eventos e resumo", open),
  stores: {
    categories: r("GET", "/store-categories", "Categorias de loja", open),
    list: r("GET", "/stores", "Lojas (busca e filtros)", open),
    get: r("GET", "/stores/:idOrSlug", "Loja com horários, cupons e desafio", open),
    favorite: r("PUT", "/stores/:id/favorite", "Favoritar loja"),
    unfavorite: r("DELETE", "/stores/:id/favorite", "Desfavoritar loja"),
    follow: r("PUT", "/stores/:id/follow", "Avisar ofertas da loja"),
    unfollow: r("DELETE", "/stores/:id/follow", "Parar de avisar ofertas"),
  },
  map: r("GET", "/map", "Andares, pontos de referência e pinos das lojas", open),
  agenda: {
    days: r("GET", "/agenda", "Dias com eventos no intervalo (?from&to)", open),
    get: r("GET", "/events/:id", "Evento", open),
    /** HTML com Open Graph: prévia com foto e texto no WhatsApp; abre o app ou mostra o resumo. */
    share: r("GET", "/events/:id/share", "Página do evento para compartilhar", open),
    interest: r("PUT", "/events/:id/interest", "Tenho interesse"),
    removeInterest: r("DELETE", "/events/:id/interest", "Remover interesse"),
  },
  coupons: {
    list: r("GET", "/coupons", "Cupons no ar", open),
    get: r("GET", "/coupons/:id", "Cupom com estoque", open),
    claim: r("POST", "/coupons/:id/claim", "Pegar cupom"),
  },
  challenges: {
    list: r("GET", "/challenges", "Desafios do mês com progresso", open),
    scan: r("POST", "/challenges/scan", "Ler QR Code de selo"),
  },
  /* Clube ARP (Fase 2): pontos, selos, lojinha e ranking. */
  club: {
    get: r("GET", "/club", "Clube ARP: pontos, selos, lojinha e ranking", open),
    joinRanking: r("PUT", "/club/ranking", "Entrar no ranking com apelido"),
    leaveRanking: r("DELETE", "/club/ranking", "Sair do ranking"),
    statement: r("GET", "/club/statement", "Extrato de Trevos (conquistas e trocas)"),
    /** Reserva os Trevos e a unidade e devolve o código para retirar no Mercado Local. */
    redeem: r("POST", "/club/prizes/:id/redeem", "Trocar Trevos por prêmio (gera o código)"),
    cancelRedemption: r(
      "POST",
      "/club/redemptions/:id/cancel",
      "Desistir de uma troca que espera retirada (Trevos voltam)",
    ),
  },
  /** Comunicados da ARP (pushes enviados a todos), do mais novo ao mais antigo. */
  news: r("GET", "/news", "Novidades da ARP", open),
  /** Pesquisa de satisfação (0 a 10) dentro do app. */
  nps: r("POST", "/nps", "Responder o NPS"),
  pushTokens: {
    register: r("POST", "/push-tokens", "Registrar token de push do aparelho"),
    remove: r("DELETE", "/push-tokens", "Desvincular token de push do aparelho"),
  },
  /* Conteúdo (Fase 2): só leitura, sem login. */
  content: {
    page: r("GET", "/content/pages/:key", "Texto da ARP (história, regras…)", open),
    artPoints: r("GET", "/content/art-points", "Pontos do Circuito Cultural", open),
    recycling: r("GET", "/content/recycling-items", "Itens do Sustentarp", open),
    jobs: r("GET", "/jobs", "Vagas no ar", open),
  },
  highlights: {
    impression: r("POST", "/highlights/:id/impression", "Registrar exibição do destaque", open),
    click: r("POST", "/highlights/:id/click", "Registrar clique no destaque", open),
  },
} as const;

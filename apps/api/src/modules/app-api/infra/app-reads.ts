import type { App } from "@arp/contracts";
import type { Page } from "../../../shared/application/pagination";
import { APP_CONTENT_CACHE_PREFIX, type Cache } from "../../../shared/application/ports/cache";
import type { LiveHighlights } from "../domain/repositories";
import type { CatalogQueries } from "./catalog.queries";
import type { FeedQueries } from "./feed.queries";
import type { VisitorQueries } from "./visitor.queries";

/** Chave estável para um objeto de query (ordem das chaves não importa). */
export function cacheKey(name: string, params: Record<string, unknown> = {}): string {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b));
  return `${APP_CONTENT_CACHE_PREFIX}${name}:${JSON.stringify(entries)}`;
}

export type HomeShared = Omit<App.Home, "summary">;

/**
 * Leituras do app em duas camadas:
 * - compartilhada: o que é igual para todo mundo (vitrines, lojas, mapa,
 *   agenda, desafios), montada como anônimo e guardada em cache curto
 *   (APP_CACHE_TTL_SECONDS), invalidada pelas escritas do painel;
 * - pessoal: só os campos do visitante (favorita, segue, meu cupom, selo
 *   ganho, interesse, resumo do mês), consultas pequenas por PK/índice,
 *   aplicadas por cima de uma cópia — o objeto em cache nunca é alterado.
 *
 * Busca livre (q) não entra no cache (cardinalidade alta, acerto baixo).
 */
export class AppReads implements LiveHighlights {
  constructor(
    private readonly deps: {
      catalog: CatalogQueries;
      feed: FeedQueries;
      visitors: VisitorQueries;
      cache: Cache;
      ttlMs: number;
    },
  ) {}

  private cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    if (this.deps.ttlMs <= 0) return load();
    return this.deps.cache.getOrLoad(key, this.deps.ttlMs, load);
  }

  /*
   * Escritas do visitante que mudam um contador compartilhado. Só a chave do
   * detalhe sai do cache (estoque do cupom, interessados no evento): limpar
   * o prefixo inteiro a cada cupom pego zeraria o cache justo no pico. Listas
   * e home convergem no TTL.
   */
  forgetCoupon(couponId: string): void {
    this.deps.cache.invalidate(cacheKey("coupon", { couponId }));
  }

  forgetEvent(eventId: string): void {
    this.deps.cache.invalidate(cacheKey("event", { eventId }));
  }

  /* Compartilhado ------------------------------------------------------- */

  homeShared(now: Date): Promise<HomeShared> {
    const { feed } = this.deps;
    return this.cached(cacheKey("home"), async () => ({
      highlights: await feed.highlights(now),
      endingCoupons: await feed.endingCoupons(now),
      activeCouponsCount: await feed.liveCouponsCount(now),
      upcomingEvents: await feed.upcomingEvents(now),
    }));
  }

  async isLive(highlightId: string, now: Date): Promise<boolean> {
    return (await this.homeShared(now)).highlights.some((h) => h.id === highlightId);
  }

  categories(): Promise<App.StoreCategory[]> {
    return this.cached(cacheKey("store-categories"), () => this.deps.catalog.categories());
  }

  map(): Promise<App.MapData> {
    return this.cached(cacheKey("map"), () => this.deps.catalog.map());
  }

  agenda(query: App.AgendaQuery): Promise<App.Agenda> {
    return this.cached(cacheKey("agenda", query), () => this.deps.feed.agenda(query));
  }

  coupons(query: App.ListCouponsQuery, now: Date): Promise<Page<App.CouponCard>> {
    const load = () => this.deps.feed.coupons(query, now);
    return query.q ? load() : this.cached(cacheKey("coupons", query), load);
  }

  /* Compartilhado + pessoal --------------------------------------------- */

  async stores(
    query: App.ListStoresQuery,
    visitorId: string | null,
    now: Date,
  ): Promise<Page<App.StoreSummary>> {
    const load = () => this.deps.catalog.stores(query, null, now);
    const page = query.q ? await load() : await this.cached(cacheKey("stores", query), load);
    if (!visitorId || page.data.length === 0) return page;
    const favorites = await this.deps.catalog.favoriteIds(
      visitorId,
      page.data.map((s) => s.id),
    );
    return {
      ...page,
      data: page.data.map((s) => (favorites.has(s.id) ? { ...s, isFavorite: true } : s)),
    };
  }

  async store(
    idOrSlug: string,
    visitorId: string | null,
    now: Date,
  ): Promise<App.StoreDetail | null> {
    const store = await this.cached(cacheKey("store", { idOrSlug }), () =>
      this.deps.catalog.store(idOrSlug, null, now),
    );
    if (!store || !visitorId) return store;
    const flags = await this.deps.catalog.storeFlags(visitorId, store.id);
    let challenge = store.challenge;
    if (challenge) {
      const earned = await this.deps.visitors.earnedChallenges(visitorId, [challenge.id]);
      const earnedAt = earned.get(challenge.id);
      if (earnedAt) challenge = { ...challenge, earned: true, earnedAt: earnedAt.toISOString() };
    }
    return { ...store, ...flags, challenge };
  }

  async event(
    eventId: string,
    visitorId: string | null,
    now: Date,
  ): Promise<App.EventDetail | null> {
    const event = await this.cached(cacheKey("event", { eventId }), () =>
      this.deps.feed.event(eventId, null, now),
    );
    if (!event || !visitorId) return event;
    return { ...event, isInterested: await this.deps.feed.isInterested(visitorId, eventId) };
  }

  async coupon(
    couponId: string,
    visitorId: string | null,
    now: Date,
  ): Promise<App.CouponDetail | null> {
    const coupon = await this.cached(cacheKey("coupon", { couponId }), () =>
      this.deps.feed.coupon(couponId, null, now),
    );
    if (!coupon || !visitorId) return coupon;
    return { ...coupon, myClaim: await this.deps.feed.myActiveClaim(couponId, visitorId, now) };
  }

  async challenges(visitorId: string | null, now: Date): Promise<App.Challenges> {
    const shared = await this.cached(cacheKey("challenges"), () =>
      this.deps.visitors.challenges(null, now),
    );
    if (!visitorId || !shared.campaign || shared.challenges.length === 0) return shared;
    const earned = await this.deps.visitors.earnedChallenges(
      visitorId,
      shared.challenges.map((c) => c.id),
    );
    const challenges = shared.challenges.map((c) => {
      const earnedAt = earned.get(c.id);
      return earnedAt ? { ...c, earned: true, earnedAt: earnedAt.toISOString() } : c;
    });
    // Progresso conta todos os selos da campanha (inclusive de desafio desativado).
    const progress = await this.deps.visitors.progress(visitorId, shared.campaign.id);
    return { ...shared, challenges, progress };
  }
}

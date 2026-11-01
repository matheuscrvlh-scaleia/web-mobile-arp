import type { App } from "@arp/contracts";
import type { StaffActor } from "../../../shared/application/actor";
import type { Cache } from "../../../shared/application/ports/cache";
import type { Clock } from "../../../shared/application/ports/clock";
import { NotFoundError } from "../../../shared/domain/errors";
import { periodRange } from "../../dashboard";
import { type MerchantStoreReader, resolveMerchantStore, STORE_NOT_FOUND } from "./merchant-scope";

/** Janela em dias de calendário de São Paulo (YYYY-MM-DD, ambos inclusive). */
export interface MerchantRange {
  from: string;
  to: string;
}

/** Hoje = só hoje; semana e mês = as janelas 7d e 30d do dashboard (terminam hoje). */
export function merchantRange(period: App.MerchantPeriod, now: Date): MerchantRange {
  if (period === "today") {
    const { today } = periodRange("7d", now);
    return { from: today, to: today };
  }
  const { from, to } = periodRange(period === "week" ? "7d" : "30d", now);
  return { from, to };
}

export interface MerchantOverviewRequest {
  storeId: string;
  range: MerchantRange;
  now: Date;
}

/** Leitura agregada da loja (SQL no infra). */
export interface MerchantOverviewReader {
  overview(
    request: MerchantOverviewRequest,
  ): Promise<Omit<App.MerchantOverview, "period" | "from" | "to" | "store">>;
}

export interface GetMerchantOverviewDeps {
  reader: MerchantOverviewReader;
  stores: MerchantStoreReader;
  cache: Cache;
  clock: Clock;
  cacheTtlMs: number;
}

export const MERCHANT_OVERVIEW_CACHE_PREFIX = "merchant-overview:";
export const overviewCachePrefix = (storeId: string) =>
  `${MERCHANT_OVERVIEW_CACHE_PREFIX}${storeId}:`;

/**
 * Números da loja no app. Cache curto por loja e período (a tela fica
 * aberta no caixa); usar um código pelo app limpa o cache da loja.
 */
export class GetMerchantOverviewUseCase {
  constructor(private readonly deps: GetMerchantOverviewDeps) {}

  async execute(
    query: { period: App.MerchantPeriod; storeId?: string | undefined },
    actor: StaffActor,
  ): Promise<App.MerchantOverview> {
    const { reader, stores, cache, clock, cacheTtlMs } = this.deps;
    const storeId = await resolveMerchantStore(actor, query.storeId, stores);
    const load = async (): Promise<App.MerchantOverview> => {
      const store = await stores.find(storeId);
      if (!store) throw new NotFoundError(STORE_NOT_FOUND);
      const now = clock.now();
      const range = merchantRange(query.period, now);
      const data = await reader.overview({ storeId, range, now });
      return { period: query.period, ...range, store, ...data };
    };
    if (cacheTtlMs <= 0) return load();
    return cache.getOrLoad(`${overviewCachePrefix(storeId)}${query.period}`, cacheTtlMs, load);
  }
}

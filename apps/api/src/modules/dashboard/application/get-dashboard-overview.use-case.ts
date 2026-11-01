import type { DashboardOverview, DashboardQuery } from "@arp/contracts";
import type { StaffActor } from "../../../shared/application/actor";
import type { Cache } from "../../../shared/application/ports/cache";
import type { Clock } from "../../../shared/application/ports/clock";
import { scopedStoreId } from "../../../shared/application/store-scope";
import { type DashboardPeriod, type PeriodRange, periodRange } from "../domain/period";

export interface OverviewRequest {
  period: DashboardPeriod;
  range: PeriodRange;
  storeId: string | null;
  now: Date;
}

/** Leitura agregada do painel (implementada com SQL no infra). */
export interface DashboardReader {
  overview(request: OverviewRequest): Promise<DashboardOverview>;
}

export interface GetDashboardOverviewDeps {
  reader: DashboardReader;
  cache: Cache;
  clock: Clock;
  cacheTtlMs: number;
}

/**
 * Indicadores do período. Lojista vê sempre a própria loja; os demais
 * podem filtrar por loja. Resultado em cache curto (consultas agregadas).
 */
export class GetDashboardOverviewUseCase {
  constructor(private readonly deps: GetDashboardOverviewDeps) {}

  async execute(query: DashboardQuery, actor: StaffActor): Promise<DashboardOverview> {
    const storeId = scopedStoreId(actor, query.storeId) ?? null;
    const load = () => {
      const now = this.deps.clock.now();
      return this.deps.reader.overview({
        period: query.period,
        range: periodRange(query.period, now),
        storeId,
        now,
      });
    };
    if (this.deps.cacheTtlMs <= 0) return load();
    return this.deps.cache.getOrLoad(
      `dashboard:${query.period}:${storeId ?? "all"}`,
      this.deps.cacheTtlMs,
      load,
    );
  }
}

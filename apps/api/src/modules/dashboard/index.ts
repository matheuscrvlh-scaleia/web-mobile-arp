import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { CoreDeps } from "../../shared/infra/core";
import { GetDashboardOverviewUseCase } from "./application/get-dashboard-overview.use-case";
import { dashboardRoutes } from "./http/dashboard.routes";
import { DashboardQueries } from "./infra/dashboard.queries";

export { type PeriodRange, periodRange } from "./domain/period";

export function createDashboardModule(core: CoreDeps) {
  const overview = new GetDashboardOverviewUseCase({
    reader: new DashboardQueries(core.db),
    cache: core.cache,
    clock: core.clock,
    cacheTtlMs: core.config.dashboardCacheTtlMs,
  });
  const routes: FastifyPluginAsyncZod = async (app) => {
    await app.register(dashboardRoutes({ overview }));
  };
  return { routes };
}

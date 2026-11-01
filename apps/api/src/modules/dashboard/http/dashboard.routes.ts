import { dashboardOverviewSchema, dashboardQuerySchema, ROUTES } from "@arp/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { staffOf } from "../../../shared/infra/http/auth";
import { createRouter } from "../../../shared/infra/http/router";
import type { GetDashboardOverviewUseCase } from "../application/get-dashboard-overview.use-case";

export function dashboardRoutes(deps: {
  overview: GetDashboardOverviewUseCase;
}): FastifyPluginAsyncZod {
  return async (app) => {
    const r = createRouter(app, { audience: "admin", tag: "Dashboard" });
    r.route(
      ROUTES.dashboard,
      { querystring: dashboardQuerySchema, response: { 200: dashboardOverviewSchema } },
      async (request) => deps.overview.execute(request.query, staffOf(request)),
    );
  };
}

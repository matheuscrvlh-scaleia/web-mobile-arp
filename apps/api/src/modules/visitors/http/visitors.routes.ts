import {
  idParamsSchema,
  listVisitorsQuerySchema,
  ROUTES,
  updateVisitorStatusBodySchema,
  visitorDetailSchema,
  visitorPageSchema,
} from "@arp/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { VISITOR_STATUS_CACHE_PREFIX } from "../../../shared/application/ports/cache";
import { orNotFound } from "../../../shared/domain/errors";
import { staffOf } from "../../../shared/infra/http/auth";
import { createRouter } from "../../../shared/infra/http/router";
import {
  type UpdateVisitorStatusUseCase,
  VISITOR_NOT_FOUND,
} from "../application/update-visitor-status.use-case";
import type { VisitorsQueries } from "../infra/visitors.queries";

export interface VisitorsRoutesDeps {
  queries: VisitorsQueries;
  updateStatus: UpdateVisitorStatusUseCase;
}

export function visitorsRoutes(deps: VisitorsRoutesDeps): FastifyPluginAsyncZod {
  const detail = async (id: string) =>
    orNotFound(await deps.queries.getVisitor(id), VISITOR_NOT_FOUND);

  return async (app) => {
    const r = createRouter(app, {
      audience: "admin",
      tag: "Visitantes",
      // Bloqueio vale na hora: o "visitante ativo?" fica em cache curto.
      invalidates: [VISITOR_STATUS_CACHE_PREFIX],
    });

    r.route(
      ROUTES.visitors.list,
      { querystring: listVisitorsQuerySchema, response: { 200: visitorPageSchema } },
      async (request) => deps.queries.listVisitors(request.query),
    );

    r.route(
      ROUTES.visitors.get,
      { params: idParamsSchema, response: { 200: visitorDetailSchema } },
      async (request) => detail(request.params.id),
    );

    r.route(
      ROUTES.visitors.updateStatus,
      {
        params: idParamsSchema,
        body: updateVisitorStatusBodySchema,
        response: { 200: visitorDetailSchema },
      },
      async (request) => {
        await deps.updateStatus.execute(
          { id: request.params.id, ...request.body },
          staffOf(request),
        );
        return detail(request.params.id);
      },
    );
  };
}

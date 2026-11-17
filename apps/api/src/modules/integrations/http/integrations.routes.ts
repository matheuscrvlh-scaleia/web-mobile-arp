import {
  connectRdStationBodySchema,
  ROUTES,
  rdStationConfigSchema,
  updateRdStationBodySchema,
} from "@arp/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { staffOf } from "../../../shared/infra/http/auth";
import { createRouter } from "../../../shared/infra/http/router";
import type { RdStationService } from "../application/rd-station.service";

export function integrationsRoutes(deps: { rdStation: RdStationService }): FastifyPluginAsyncZod {
  return async (app) => {
    const r = createRouter(app, { audience: "admin", tag: "Integrações" });
    const ok = { response: { 200: rdStationConfigSchema } };
    const rd = ROUTES.integrations.rdStation;

    r.route(rd.get, ok, async () => deps.rdStation.get());

    r.route(rd.update, { body: updateRdStationBodySchema, ...ok }, async (request) =>
      deps.rdStation.update(request.body, staffOf(request)),
    );

    r.route(rd.connect, { body: connectRdStationBodySchema, ...ok }, async (request) =>
      deps.rdStation.connect(request.body.code, staffOf(request)),
    );

    r.route(rd.test, ok, async () => deps.rdStation.test());

    r.route(rd.remove, {}, async (request, reply) => {
      await deps.rdStation.remove(staffOf(request));
      return reply.status(204).send();
    });
  };
}

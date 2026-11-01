import { App, idParamsSchema } from "@arp/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { VisitorActor } from "../../../shared/application/actor";
import type { Clock } from "../../../shared/application/ports/clock";
import { visitorOf } from "../../../shared/infra/http/auth";
import { type ContractRoute, createRouter } from "../../../shared/infra/http/router";
import type {
  RegisterPushTokenUseCase,
  RemovePushTokenUseCase,
} from "../application/register-push-token.use-case";
import type { SetEventInterestUseCase } from "../application/set-event-interest.use-case";
import type { SetStoreFavoriteUseCase } from "../application/set-store-favorite.use-case";
import type { SetStoreFollowUseCase } from "../application/set-store-follow.use-case";
import type { TrackHighlightUseCase } from "../application/track-highlight.use-case";
import type { AppReads } from "../infra/app-reads";
import type { CatalogQueries } from "../infra/catalog.queries";
import type { VisitorQueries } from "../infra/visitor.queries";

export interface AppEngagementRoutesDeps {
  setFavorite: SetStoreFavoriteUseCase;
  setFollow: SetStoreFollowUseCase;
  setInterest: SetEventInterestUseCase;
  registerPushToken: RegisterPushTokenUseCase;
  removePushToken: RemovePushTokenUseCase;
  trackHighlight: TrackHighlightUseCase;
  /** Interesse muda o contador do evento em cache. */
  reads: Pick<AppReads, "forgetEvent">;
  catalog: CatalogQueries;
  visitors: VisitorQueries;
  clock: Clock;
}

const { APP_ROUTES } = App;

/** Carteira, favoritos, seguir loja, interesse, push e métricas de destaque. */
export function appEngagementRoutes(deps: AppEngagementRoutesDeps): FastifyPluginAsyncZod {
  return async (app) => {
    const r = createRouter(app, { audience: "app", tag: "App: interações" });

    r.route(
      APP_ROUTES.me.wallet,
      { querystring: App.walletQuerySchema, response: { 200: App.walletSchema } },
      async (request) =>
        deps.visitors.wallet(visitorOf(request).id, request.query, deps.clock.now()),
    );

    r.route(
      APP_ROUTES.me.favorites,
      { response: { 200: App.favoriteStoresSchema } },
      async (request) => ({
        data: await deps.catalog.favorites(visitorOf(request).id, deps.clock.now()),
      }),
    );

    // Marcar/desmarcar: PUT adiciona e DELETE remove, ambos idempotentes.
    type Toggle = (id: string, on: boolean, actor: VisitorActor) => Promise<void>;
    const favorite: Toggle = (id, on, actor) =>
      deps.setFavorite.execute({ storeId: id, on }, actor);
    const follow: Toggle = (id, on, actor) => deps.setFollow.execute({ storeId: id, on }, actor);
    const interest: Toggle = async (id, on, actor) => {
      await deps.setInterest.execute({ eventId: id, on }, actor);
      deps.reads.forgetEvent(id);
    };
    const toggles: [ContractRoute, boolean, Toggle][] = [
      [APP_ROUTES.stores.favorite, true, favorite],
      [APP_ROUTES.stores.unfavorite, false, favorite],
      [APP_ROUTES.stores.follow, true, follow],
      [APP_ROUTES.stores.unfollow, false, follow],
      [APP_ROUTES.agenda.interest, true, interest],
      [APP_ROUTES.agenda.removeInterest, false, interest],
    ];
    for (const [def, on, toggle] of toggles) {
      r.route(def, { params: idParamsSchema }, async (request, reply) => {
        await toggle(request.params.id, on, visitorOf(request));
        return reply.status(204).send();
      });
    }

    r.route(
      APP_ROUTES.pushTokens.register,
      { body: App.registerPushTokenBodySchema },
      async (request, reply) => {
        await deps.registerPushToken.execute(request.body, visitorOf(request));
        return reply.status(204).send();
      },
    );

    r.route(
      APP_ROUTES.pushTokens.remove,
      { body: App.removePushTokenBodySchema },
      async (request, reply) => {
        await deps.removePushToken.execute(request.body, visitorOf(request));
        return reply.status(204).send();
      },
    );

    for (const [def, interaction] of [
      [APP_ROUTES.highlights.impression, "impression"],
      [APP_ROUTES.highlights.click, "click"],
    ] as const) {
      r.route(def, { params: idParamsSchema }, async (request, reply) => {
        await deps.trackHighlight.execute({ highlightId: request.params.id, interaction });
        return reply.status(204).send();
      });
    }
  };
}

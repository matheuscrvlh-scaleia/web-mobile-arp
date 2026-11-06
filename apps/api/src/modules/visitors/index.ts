import type { CoreDeps } from "../../shared/infra/core";
import type { SessionService } from "../identity";
import { AnonymizeVisitorUseCase } from "./application/anonymize-visitor.use-case";
import { UpdateVisitorStatusUseCase } from "./application/update-visitor-status.use-case";
import type { VisitorSessions } from "./domain/repositories";
import { visitorsRoutes } from "./http/visitors.routes";
import { PgVisitorRepository } from "./infra/pg-visitor-repository";
import { VisitorsQueries } from "./infra/visitors.queries";

export function createVisitorsModule(core: CoreDeps, deps: { sessions: SessionService }) {
  const { db, uow, audit, clock } = core;
  const queries = new VisitorsQueries(db);
  const visitors = new PgVisitorRepository(db);
  // Bloqueio derruba os logins do app (refresh) na mesma transação.
  const sessions: VisitorSessions = {
    revokeAll: (visitorId) => deps.sessions.endAllFor(visitorId, "app"),
  };
  const routes = visitorsRoutes({
    queries,
    updateStatus: new UpdateVisitorStatusUseCase({ visitors, sessions, audit, uow }),
    anonymize: new AnonymizeVisitorUseCase({ visitors, sessions, audit, clock, uow }),
  });
  return { routes };
}

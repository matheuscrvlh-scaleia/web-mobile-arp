import type { CoreDeps } from "../../shared/infra/core";
import type { Job } from "../../shared/infra/jobs/scheduler";
import { RdStationService } from "./application/rd-station.service";
import { integrationsRoutes } from "./http/integrations.routes";
import { SecretBox } from "./infra/secret-box";

/** Integrações configuradas pelo painel. Hoje: RD Station Marketing (OAuth). */
export function createIntegrationsModule(core: CoreDeps, options: { secret: string }) {
  const { db, uow, audit, clock, logger } = core;
  const rdStation = new RdStationService({
    db,
    uow,
    audit,
    clock,
    logger,
    box: new SecretBox(options.secret),
  });

  // Leva ao RD quem marcou "Quero receber novidades e ofertas". Sem configuração
  // ativa e conectada a rodada não faz nada.
  const rdStationLeadsJob: Job = {
    name: "rd-station-leads",
    intervalMs: 10 * 60_000,
    async run() {
      const sent = await rdStation.sendPending();
      if (sent > 0) logger.info({ contatos: sent }, "Contatos enviados ao RD Station");
    },
  };

  return { routes: integrationsRoutes({ rdStation }), jobs: [rdStationLeadsJob] };
}

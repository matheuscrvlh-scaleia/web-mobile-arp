import type { ImportSiteEventsResult } from "@arp/contracts";
import type { StaffActor } from "../../../shared/application/actor";
import { snapshot } from "../../../shared/application/audit-changes";
import type { Clock } from "../../../shared/application/ports/clock";
import { ValidationError } from "../../../shared/domain/errors";
import { toLocal } from "../../../shared/domain/time";
import { AgendaEvent } from "../domain/agenda-event";
import type { SiteEventSource, SiteImportLog } from "../domain/repositories";
import { assertReferences, type EventUseCaseDeps } from "./agenda-deps";

export interface ImportSiteEventsDeps extends EventUseCaseDeps {
  source: SiteEventSource;
  imports: SiteImportLog;
  clock: Clock;
}

/**
 * Traz do site os eventos de hoje em diante que ainda não vieram, todos como
 * rascunho (fora do app) na categoria escolhida. Post já importado nunca é
 * sobrescrito nem recriado: o que o gestor editou ou apagou aqui fica assim.
 */
export class ImportSiteEventsUseCase {
  constructor(private readonly deps: ImportSiteEventsDeps) {}

  async execute(input: { categoryId: string }, actor: StaffActor): Promise<ImportSiteEventsResult> {
    const { source, imports, references, events, audit, uow, clock } = this.deps;
    await assertReferences(references, { categoryId: input.categoryId });
    const site = await source.upcoming(toLocal(clock.now()).date);
    const already = await imports.importedIds(site.events.map((e) => e.siteId));
    let created = 0;
    let failed = site.failed;

    for (const item of site.events) {
      if (already.has(item.siteId)) continue;
      let data: ReturnType<typeof AgendaEvent.validateNew>;
      try {
        data = AgendaEvent.validateNew({
          ...item.event,
          categoryId: input.categoryId,
          status: "draft",
        });
      } catch (err) {
        if (!(err instanceof ValidationError)) throw err;
        failed++;
        continue;
      }
      // Um evento por transação: um post ruim não desfaz os outros.
      await uow.run(async () => {
        const event = await events.create(data);
        await imports.record({ siteId: item.siteId, eventId: event.id, siteUrl: item.siteUrl });
        await audit.log({
          actor,
          action: "event.create",
          entityType: "event",
          entityId: event.id,
          changes: snapshot(event.toState()),
        });
      });
      created++;
    }
    return { created, skipped: already.size, failed };
  }
}

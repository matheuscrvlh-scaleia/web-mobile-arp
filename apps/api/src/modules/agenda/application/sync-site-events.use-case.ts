import type { SyncSiteEventsResult } from "@arp/contracts";
import type { StaffActor } from "../../../shared/application/actor";
import { diff, hasChanges, snapshot } from "../../../shared/application/audit-changes";
import type { Clock } from "../../../shared/application/ports/clock";
import { ConflictError, ValidationError } from "../../../shared/domain/errors";
import { toLocal } from "../../../shared/domain/time";
import { AgendaEvent } from "../domain/agenda-event";
import type { SiteEvent, SiteEventSource, SiteImportLog } from "../domain/repositories";
import { assertReferences, type EventUseCaseDeps } from "./agenda-deps";

export interface SyncSiteEventsDeps extends EventUseCaseDeps {
  source: SiteEventSource;
  imports: SiteImportLog;
  clock: Clock;
}

/**
 * O site é a fonte da agenda. Post novo (de hoje em diante) entra fora do app
 * (rascunho) na categoria escolhida; o que mudou lá é atualizado aqui; o que
 * saiu do site é apagado aqui. Daqui só se escolhe mostrar ou não no app:
 * situação e categoria nunca são mexidas pela sincronização.
 */
export class SyncSiteEventsUseCase {
  constructor(private readonly deps: SyncSiteEventsDeps) {}

  async execute(input: { categoryId: string }, actor: StaffActor): Promise<SyncSiteEventsResult> {
    const { source, imports, references, clock } = this.deps;
    await assertReferences(references, { categoryId: input.categoryId });
    const site = await source.snapshot(toLocal(clock.now()).date);
    const links = new Map((await imports.all()).map((l) => [l.siteId, l.eventId]));
    const result: SyncSiteEventsResult = {
      created: 0,
      updated: 0,
      removed: 0,
      failed: site.failed,
    };

    // Um evento por transação: um post ruim não desfaz os outros.
    for (const item of site.events) {
      const eventId = links.get(item.siteId);
      try {
        if (eventId) {
          if (await this.update(eventId, item, actor)) result.updated++;
        } else {
          await this.create(item, input.categoryId, actor);
          result.created++;
        }
      } catch (err) {
        if (!(err instanceof ValidationError)) throw err;
        result.failed++;
      }
    }

    // Site vazio é mais provável erro de leitura do que agenda apagada.
    if (site.allIds.size > 0) {
      for (const [siteId, eventId] of links) {
        if (!eventId || site.allIds.has(siteId)) continue;
        if (await this.remove(eventId, actor)) result.removed++;
      }
    }
    return result;
  }

  private async create(item: SiteEvent, categoryId: string, actor: StaffActor) {
    const data = AgendaEvent.validateNew({ ...item.event, categoryId, status: "draft" });
    await this.deps.uow.run(async () => {
      const event = await this.deps.events.create(data);
      await this.deps.imports.record({
        siteId: item.siteId,
        eventId: event.id,
        siteUrl: item.siteUrl,
      });
      await this.deps.audit.log({
        actor,
        action: "event.create",
        entityType: "event",
        entityId: event.id,
        changes: snapshot(event.toState()),
      });
    });
  }

  /** true = mudou algo. */
  private update(eventId: string, item: SiteEvent, actor: StaffActor): Promise<boolean> {
    return this.deps.uow.run(async () => {
      const event = await this.deps.events.findById(eventId);
      if (!event) return false;
      const before = event.toState();
      // Só o que vem do site; selo, andar, loja e aparência ficam como estão.
      const e = item.event;
      event.update({
        title: e.title,
        description: e.description,
        imageUrl: e.imageUrl,
        place: e.place,
        recurrence: e.recurrence,
        startsOn: e.startsOn,
        endsOn: e.endsOn,
        weekdays: e.weekdays,
        startTime: e.startTime,
        endTime: e.endTime,
      });
      const changes = diff(before, event.toState());
      if (!hasChanges(changes)) return false;
      await this.deps.events.save(event);
      await this.deps.audit.log({
        actor,
        action: "event.update",
        entityType: "event",
        entityId: event.id,
        changes,
      });
      return true;
    });
  }

  /**
   * Apaga (interesses vão junto). Ligado a desafio não dá: arquiva (sai do
   * app), em outra transação, porque o delete que falhou aborta a dele.
   * true = mudou algo.
   */
  private async remove(eventId: string, actor: StaffActor): Promise<boolean> {
    const { uow, events, audit, clock } = this.deps;
    try {
      return await uow.run(async () => {
        const event = await events.findById(eventId);
        if (!event) return false;
        await events.delete(event.id);
        await audit.log({
          actor,
          action: "event.delete",
          entityType: "event",
          entityId: event.id,
          changes: snapshot(event.toState()),
        });
        return true;
      });
    } catch (err) {
      if (!(err instanceof ConflictError)) throw err;
    }
    return uow.run(async () => {
      const event = await events.findById(eventId);
      if (!event || event.toState().archivedAt) return false;
      const before = event.toState();
      event.archive(clock.now());
      await events.save(event);
      await audit.log({
        actor,
        action: "event.archive",
        entityType: "event",
        entityId: event.id,
        changes: diff(before, event.toState()),
      });
      return true;
    });
  }
}

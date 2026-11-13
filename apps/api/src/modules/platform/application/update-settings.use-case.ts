import type { AppSettings } from "@arp/contracts";
import type { StaffActor } from "../../../shared/application/actor";
import { diff, hasChanges } from "../../../shared/application/audit-changes";
import type { AuditLogger } from "../../../shared/application/ports/audit-logger";
import type { Clock } from "../../../shared/application/ports/clock";
import type { UnitOfWork } from "../../../shared/application/ports/unit-of-work";
import { addDaysToDate, toLocal } from "../../../shared/domain/time";
import { presentChanges, resolveSettings, type SettingsStore } from "./app-settings";

export interface UpdateSettingsDeps {
  settings: SettingsStore;
  audit: AuditLogger;
  uow: UnitOfWork;
  clock: Clock;
}

/** Grava só as chaves enviadas que mudaram e devolve as configurações completas. */
export class UpdateSettingsUseCase {
  constructor(private readonly deps: UpdateSettingsDeps) {}

  async execute(input: Partial<AppSettings>, actor: StaffActor): Promise<AppSettings> {
    const { settings, audit, uow } = this.deps;
    return uow.run(async () => {
      const before = resolveSettings(await settings.readAll());
      const after: AppSettings = { ...before, ...presentChanges(input) };
      // Validade dos Trevos já vencida e a ARP escolheu outra: os Trevos que
      // venceram não voltam. Passam a contar os ganhos depois da antiga.
      const expired = toLocal(this.deps.clock.now()).date > before.trevosValidUntil;
      if (
        expired &&
        after.trevosValidUntil !== before.trevosValidUntil &&
        input.trevosCountFrom === undefined
      ) {
        after.trevosCountFrom = addDaysToDate(before.trevosValidUntil, 1);
      }
      const changes = diff(before, after);
      if (!hasChanges(changes)) return before;

      for (const key of Object.keys(changes) as (keyof AppSettings)[]) {
        await settings.upsert(key, after[key], actor.id);
      }
      await audit.log({
        actor,
        action: "setting.update",
        entityType: "settings",
        entityId: null,
        changes,
      });
      return after;
    });
  }
}

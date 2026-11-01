import type { AppSettings } from "@arp/contracts";
import type { StaffActor } from "../../../shared/application/actor";
import { diff, hasChanges } from "../../../shared/application/audit-changes";
import type { AuditLogger } from "../../../shared/application/ports/audit-logger";
import type { UnitOfWork } from "../../../shared/application/ports/unit-of-work";
import { presentChanges, resolveSettings, type SettingsStore } from "./app-settings";

export interface UpdateSettingsDeps {
  settings: SettingsStore;
  audit: AuditLogger;
  uow: UnitOfWork;
}

/** Grava só as chaves enviadas que mudaram e devolve as configurações completas. */
export class UpdateSettingsUseCase {
  constructor(private readonly deps: UpdateSettingsDeps) {}

  async execute(input: Partial<AppSettings>, actor: StaffActor): Promise<AppSettings> {
    const { settings, audit, uow } = this.deps;
    return uow.run(async () => {
      const before = resolveSettings(await settings.readAll());
      const after: AppSettings = { ...before, ...presentChanges(input) };
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

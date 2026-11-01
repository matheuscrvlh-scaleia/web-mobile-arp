import type { AppSettings } from "@arp/contracts";
import { resolveSettings, type SettingsStore } from "./app-settings";

export class GetSettingsUseCase {
  constructor(private readonly deps: { settings: SettingsStore }) {}

  async execute(): Promise<AppSettings> {
    return resolveSettings(await this.deps.settings.readAll());
  }
}

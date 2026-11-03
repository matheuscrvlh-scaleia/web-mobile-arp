import { type AppSettings, appSettingsSchema } from "@arp/contracts";

/** Valores usados quando a chave ainda não foi gravada (ou está inválida no banco). */
export const DEFAULT_APP_SETTINGS: AppSettings = {
  couponDefaultWindowHours: 24,
  supportWhatsapp: null,
  supportEmail: null,
  aboutText: "",
  termsUrl: null,
  privacyUrl: null,
  parkingInfo: "",
  tourInfo: "",
  jobDays: 30,
  pointsValidityMonths: 12,
  pointsExpiryNoticeDays: 15,
};

export const SETTING_KEYS = Object.keys(DEFAULT_APP_SETTINGS) as (keyof AppSettings)[];

/** Porta de leitura/escrita das configurações (uma linha por chave). */
export interface SettingsStore {
  readAll(): Promise<Record<string, unknown>>;
  upsert(key: keyof AppSettings, value: unknown, updatedBy: string | null): Promise<void>;
}

/**
 * Configurações efetivas: o que está gravado e é válido para a chave,
 * senão o padrão. Chaves desconhecidas no banco são ignoradas.
 */
export function resolveSettings(stored: Record<string, unknown>): AppSettings {
  const out: Record<string, unknown> = { ...DEFAULT_APP_SETTINGS };
  for (const key of SETTING_KEYS) {
    if (!(key in stored)) continue;
    const parsed = appSettingsSchema.shape[key].safeParse(stored[key]);
    if (parsed.success) out[key] = parsed.data;
  }
  return out as AppSettings;
}

/** Só as chaves presentes no PATCH (undefined = não mexe). */
export function presentChanges(input: Partial<AppSettings>): Partial<AppSettings> {
  return Object.fromEntries(
    Object.entries(input).filter(
      ([key, value]) => value !== undefined && (SETTING_KEYS as string[]).includes(key),
    ),
  ) as Partial<AppSettings>;
}

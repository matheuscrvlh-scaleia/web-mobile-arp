import { z } from "zod";
import {
  cursorQuerySchema,
  isoDateSchema,
  isoDateTimeSchema,
  paginated,
  paginationQuerySchema,
  urlSchema,
} from "./common";

/* Histórico (auditoria) -------------------------------------------------- */

export const actorTypeSchema = z.enum(["staff", "visitor", "system"]);
export type ActorType = z.infer<typeof actorTypeSchema>;

export const auditLogSchema = z.object({
  /** bigint serializado como string. */
  id: z.string(),
  actor: z.object({
    type: actorTypeSchema,
    id: z.string().nullable(),
    name: z.string().nullable(),
  }),
  /** Verbo no formato <entidade>.<ação> (ex.: coupon.create, claim.redeem). */
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable(),
  /** { campo: { from, to } } nas edições; snapshot nas criações. */
  changes: z.record(z.string(), z.unknown()).nullable(),
  ip: z.string().nullable(),
  createdAt: isoDateTimeSchema,
});
export type AuditLog = z.infer<typeof auditLogSchema>;
export const auditLogPageSchema = paginated(auditLogSchema);

export const listAuditLogsQuerySchema = paginationQuerySchema.extend({
  ...cursorQuerySchema.shape,
  actorId: z.uuid().optional(),
  entityType: z.string().trim().max(40).optional(),
  entityId: z.string().trim().max(60).optional(),
  action: z.string().trim().max(60).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});
export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;

/* Configurações do app --------------------------------------------------- */

export const appSettingsSchema = z.object({
  /** Prazo padrão sugerido ao criar um cupom. */
  couponDefaultWindowHours: z.number().int().min(1).max(720),
  supportWhatsapp: z.string().trim().max(20).nullable(),
  supportEmail: z.email().nullable(),
  aboutText: z.string().trim().max(2000),
  termsUrl: urlSchema.nullable(),
  privacyUrl: urlSchema.nullable(),
  /** Texto do painel "Estacionamento" do app. */
  parkingInfo: z.string().trim().max(1000),
  /** Texto do painel "Tour da ARP" do app. */
  tourInfo: z.string().trim().max(1000),
  /** Dias que uma vaga fica no ar antes de sair sozinha (padrão 30). */
  jobDays: z.number().int().min(1).max(90),
});
export type AppSettings = z.infer<typeof appSettingsSchema>;

export const updateAppSettingsBodySchema = appSettingsSchema.partial();
export type UpdateAppSettingsBody = z.infer<typeof updateAppSettingsBodySchema>;

/* Envio de arquivos ------------------------------------------------------ */

export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const UPLOAD_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const uploadResponseSchema = z.object({
  /** URL pública (Supabase Storage) ou caminho local em dev (/uploads/…). */
  url: z.string(),
  mimeType: z.enum(UPLOAD_MIME_TYPES),
  size: z.number().int(),
});
export type UploadResponse = z.infer<typeof uploadResponseSchema>;

/* Saúde ------------------------------------------------------------------ */

export const healthSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  version: z.string(),
  uptime: z.number(),
  checks: z.record(z.string(), z.enum(["up", "down"])),
});
export type Health = z.infer<typeof healthSchema>;

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
  /** Nome atual do item (ou o do registro, se ele já foi excluído). */
  entityName: z.string().nullable(),
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
  /** Tipo de ação, sem depender da entidade (criou, editou, excluiu…). */
  verb: z.enum(["create", "update", "delete", "status"]).optional(),
  /** "true" esconde entradas e envios de arquivo (o barulho do histórico). */
  hideAccess: z.enum(["true", "false"]).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});
export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;

/** Pessoas da equipe que aparecem no histórico (filtro "Quem"). */
export const auditActorListSchema = z.object({
  data: z.array(z.object({ id: z.string(), name: z.string() })),
});
export type AuditActorList = z.infer<typeof auditActorListSchema>;

/* Configurações do app --------------------------------------------------- */

/** Validade dos Trevos antes de a ARP escolher uma na gestão. */
export const DEFAULT_TREVOS_VALID_UNTIL = "2027-12-31";

export const appSettingsSchema = z.object({
  /** Prazo padrão sugerido ao criar um cupom. */
  couponDefaultWindowHours: z
    .number({ error: "Informe as horas" })
    .int("Use horas inteiras")
    .min(1, "Use pelo menos 1 hora")
    .max(720, "Use no máximo 720 horas (30 dias)"),
  supportWhatsapp: z.string().trim().max(20).nullable(),
  supportEmail: z.email("E-mail inválido (ex.: contato@arp.com.br)").nullable(),
  aboutText: z.string().trim().max(2000),
  termsUrl: urlSchema.nullable(),
  privacyUrl: urlSchema.nullable(),
  /** Texto do painel "Estacionamento" do app. */
  parkingInfo: z.string().trim().max(1000),
  /** Texto do painel "Tour da ARP" do app. */
  tourInfo: z.string().trim().max(1000),
  /** Dias que uma vaga fica no ar antes de sair sozinha (padrão 30). */
  jobDays: z
    .number({ error: "Informe os dias" })
    .int("Use dias inteiros")
    .min(1, "Use pelo menos 1 dia")
    .max(90, "Use no máximo 90 dias"),
  /**
   * Até quando os Trevos valem para troca (AAAA-MM-DD, inclusive). A ARP
   * escolhe na gestão: ex. 31/12/2027 no ano, ou 6 meses num piloto.
   */
  trevosValidUntil: isoDateSchema,
  /**
   * Contam os Trevos ganhos a partir deste dia (null = desde o início). Quando
   * a validade vence e a ARP escolhe outra, passa a ser o dia seguinte à antiga.
   */
  trevosCountFrom: isoDateSchema.nullable(),
  /** Dias antes de vencer para avisar o visitante por push (0 = sem aviso). */
  pointsExpiryNoticeDays: z
    .number({ error: "Informe os dias (0 = sem aviso)" })
    .int("Use dias inteiros")
    .min(0, "Use 0 para não avisar")
    .max(60, "Use no máximo 60 dias"),
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

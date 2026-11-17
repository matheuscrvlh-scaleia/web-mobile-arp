import { z } from "zod";
import { isoDateTimeSchema } from "./common";

/* RD Station Marketing (OAuth) ------------------------------------------- */

/**
 * disconnected = sem autorização (falta Conectar); connected = autorizado e o
 * último teste/envio deu certo; error = o último teste ou envio falhou.
 */
export const rdStationStatusSchema = z.enum(["disconnected", "connected", "error"]);
export type RdStationStatus = z.infer<typeof rdStationStatusSchema>;

/** O secret e o refresh token nunca saem da API: só se diz se existem. */
export const rdStationConfigSchema = z.object({
  clientId: z.string().nullable(),
  hasSecret: z.boolean(),
  conversion: z.string().nullable(),
  active: z.boolean(),
  status: rdStationStatusSchema,
  /** Mensagem do último teste ou da última falha de envio. */
  message: z.string().nullable(),
  testedAt: isoDateTimeSchema.nullable(),
  configuredAt: isoDateTimeSchema.nullable(),
  configuredBy: z.string().nullable(),
  /** Contatos com opt-in que ainda não foram ao RD. */
  pending: z.number().int(),
  lastSentAt: isoDateTimeSchema.nullable(),
});
export type RdStationConfig = z.infer<typeof rdStationConfigSchema>;

const conversionSchema = z
  .string()
  .trim()
  .min(1, "Informe o identificador da conversão")
  .max(100)
  .regex(/^[\w.-]+$/, "Use só letras, números, ponto, hífen e sublinhado");

export const updateRdStationBodySchema = z.object({
  clientId: z.string().trim().min(1, "Informe o Client ID").max(200),
  /** Em branco ou ausente mantém o salvo. */
  clientSecret: z.string().trim().max(500).optional(),
  conversion: conversionSchema.nullable(),
  active: z.boolean(),
  /** Grava mesmo que o teste com o RD falhe (só testa se já estiver conectado). */
  saveIfTestFails: z.boolean().default(false),
  /** true = só grava, sem testar (usado antes de abrir a autorização). */
  skipTest: z.boolean().default(false),
});
export type UpdateRdStationBody = z.infer<typeof updateRdStationBodySchema>;

/** Volta da autorização: o code (vale uma vez, por pouco tempo). */
export const connectRdStationBodySchema = z.object({
  code: z.string().trim().min(1).max(500),
});
export type ConnectRdStationBody = z.infer<typeof connectRdStationBodySchema>;

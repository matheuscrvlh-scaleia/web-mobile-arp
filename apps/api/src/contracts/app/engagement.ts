import { z } from "zod";
import { idSchema, isoDateTimeSchema, listOf } from "../common";
import { storeSummarySchema } from "./stores";

/* Favoritos, lojas seguidas, interesse em evento e tokens de push. */

/** Lojas favoritas do visitante. */
export const favoriteStoresSchema = listOf(storeSummarySchema);

export const pushPlatformSchema = z.enum(["ios", "android"]);

/** Token do Expo Push: `ExponentPushToken[...]` (ou `ExpoPushToken[...]`). */
export const pushTokenSchema = z
  .string()
  .trim()
  .max(300)
  .regex(/^Expo(nent)?PushToken\[[^\]\s]{8,250}\]$/, "Token de push inválido");

/** Token do aparelho. Token já usado por outra conta troca de dono. */
export const registerPushTokenBodySchema = z.object({
  token: pushTokenSchema,
  platform: pushPlatformSchema,
});
export type RegisterPushTokenBody = z.infer<typeof registerPushTokenBodySchema>;

/** Desvincula o token do aparelho (o aparelho para de receber push desta conta). */
export const removePushTokenBodySchema = z.object({ token: pushTokenSchema });
export type RemovePushTokenBody = z.infer<typeof removePushTokenBodySchema>;

/* Novidades -------------------------------------------------------------- */

/** Comunicado enviado pela ARP a todos (push com público "todos" ou "aceitaram"). */
export const newsItemSchema = z.object({
  id: idSchema,
  title: z.string(),
  body: z.string(),
  /** Tela do app que abre ao tocar (arp://...) ou link https (null = só o texto). */
  deepLink: z.string().nullable(),
  sentAt: isoDateTimeSchema,
});
export type NewsItem = z.infer<typeof newsItemSchema>;
export const newsSchema = listOf(newsItemSchema);
export const NEWS_LIMIT = 30;
export const NEWS_MAX_AGE_DAYS = 90;

/* NPS -------------------------------------------------------------------- */

/** Resposta do NPS: nota de 0 a 10 e um comentário opcional. */
export const npsBodySchema = z.object({
  score: z
    .number()
    .int()
    .min(0, "Escolha uma nota de 0 a 10")
    .max(10, "Escolha uma nota de 0 a 10"),
  comment: z.string().trim().max(500, "Use até 500 letras").optional(),
});
export type NpsBody = z.infer<typeof npsBodySchema>;

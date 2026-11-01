import { z } from "zod";
import { listOf } from "../common";
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

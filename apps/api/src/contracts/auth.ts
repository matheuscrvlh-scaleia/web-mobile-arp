import { z } from "zod";
import { idSchema, refSchema } from "./common";
import { permissionSchema } from "./permissions";

/** Regra de senha do painel: 8+ caracteres, com letra e número. */
export const passwordSchema = z
  .string()
  .min(8, "A senha precisa de pelo menos 8 caracteres")
  .max(128)
  .regex(/[A-Za-z]/, "A senha precisa ter uma letra")
  .regex(/\d/, "A senha precisa ter um número");

export const loginBodySchema = z.object({
  email: z.email("E-mail inválido").trim().toLowerCase(),
  password: z.string().min(1, "Informe a senha").max(128),
});
export type LoginBody = z.infer<typeof loginBodySchema>;

/** Quem está logado no painel. Vai no /auth/me e no login. */
export const authUserSchema = z.object({
  id: idSchema,
  name: z.string(),
  email: z.string(),
  role: refSchema,
  permissions: z.array(permissionSchema),
  /** Usuário de lojista: só enxerga e valida o que é da própria loja. */
  store: refSchema.nullable(),
  mustChangePassword: z.boolean(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

/**
 * Login e refresh devolvem o access token (curto, vai no header
 * Authorization). O refresh token vai num cookie httpOnly (painel web).
 */
export const sessionResponseSchema = z.object({
  accessToken: z.string(),
  /** Segundos até o access token expirar. */
  expiresIn: z.number().int(),
  user: authUserSchema,
});
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

export const changePasswordBodySchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: passwordSchema,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: "A nova senha precisa ser diferente da atual",
    path: ["newPassword"],
  });
export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;

/** Nome do cookie do refresh token do painel. */
export const REFRESH_COOKIE = "arp_rt";

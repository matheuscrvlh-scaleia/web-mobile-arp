import { z } from "zod";
import { passwordSchema } from "../auth";
import { idSchema, isoDateTimeSchema } from "../common";
import { pushTokenSchema } from "./engagement";

/*
 * Conta do visitante no app. Tokens próprios (audiência "app"): o access
 * token vai no header Authorization e o refresh token no CORPO das chamadas
 * de refresh/logout (o app guarda no armazenamento seguro do aparelho).
 */

const phone = z
  .string()
  .trim()
  .max(20)
  .regex(/^[\d\s()+-]*$/, "Telefone inválido");

export const registerBodySchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(120),
  email: z.email("E-mail inválido").trim().toLowerCase(),
  phone: phone.nullable().optional(),
  password: passwordSchema,
  /** Aceite dos termos de uso e da política de privacidade (obrigatório). */
  acceptTerms: z.literal(true, "Aceite os termos para continuar"),
  /** Aceite de comunicação (LGPD), separado dos termos. */
  marketingOptIn: z.boolean().default(false),
});
export type RegisterBody = z.infer<typeof registerBodySchema>;
export type RegisterInput = z.input<typeof registerBodySchema>;

export const loginBodySchema = z.object({
  email: z.email("E-mail inválido").trim().toLowerCase(),
  password: z.string().min(1, "Informe a senha").max(128),
});
export type LoginBody = z.infer<typeof loginBodySchema>;

export const socialProviderSchema = z.enum(["google", "apple"]);
export type SocialProvider = z.infer<typeof socialProviderSchema>;

/**
 * Login social: o app manda o id_token do Google/Apple e a API valida.
 * Conta nova exige `acceptTerms: true`; sem ele a resposta é 422
 * TERMS_REQUIRED (o app mostra os termos e reenvia). E-mail já cadastrado
 * por outro método → 409 EMAIL_USES_OTHER_LOGIN (`details.provider`).
 */
export const socialLoginBodySchema = z.object({
  provider: socialProviderSchema,
  idToken: z.string().min(20).max(8192),
  /** O mesmo valor do claim `nonce` (na Apple também vale o nonce cru, antes do SHA-256). */
  nonce: z.string().min(1).max(512).optional(),
  /** A Apple só manda o nome no 1º login, para o app: repasse aqui. */
  name: z.string().trim().max(120).optional(),
  acceptTerms: z.boolean().optional(),
  marketingOptIn: z.boolean().default(false),
});
export type SocialLoginBody = z.infer<typeof socialLoginBodySchema>;
export type SocialLoginInput = z.input<typeof socialLoginBodySchema>;

/** Esqueci a senha: sempre 204 (não revela se o e-mail tem conta). */
export const forgotPasswordBodySchema = z.object({
  email: z.email("E-mail inválido").trim().toLowerCase(),
});
export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>;

/** Nova senha com o código de 6 dígitos do e-mail; já devolve a sessão. */
export const resetPasswordBodySchema = z.object({
  email: z.email("E-mail inválido").trim().toLowerCase(),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Informe o código de 6 dígitos"),
  password: passwordSchema,
});
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;

/** Refresh e logout: o token opaco vai no corpo. */
export const refreshBodySchema = z.object({ refreshToken: z.string().min(20).max(200) });
export type RefreshBody = z.infer<typeof refreshBodySchema>;

/**
 * Logout: revoga o login e, com `pushToken`, desvincula o push do aparelho
 * (sem isso o aparelho continuaria recebendo push da conta que saiu).
 */
export const logoutBodySchema = refreshBodySchema.extend({
  pushToken: pushTokenSchema.optional(),
});
export type LogoutBody = z.infer<typeof logoutBodySchema>;

export const visitorProfileSchema = z.object({
  id: idSchema,
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  marketingOptIn: z.boolean(),
  createdAt: isoDateTimeSchema,
});
export type VisitorProfile = z.infer<typeof visitorProfileSchema>;

/** Resumo do mês do visitante (home e perfil). Mês = mês corrente em America/Sao_Paulo. */
export const monthSummarySchema = z.object({
  /** Selos ganhos na campanha no ar. */
  sealsEarned: z.number().int(),
  /** Desafios ativos da campanha no ar. */
  sealsTotal: z.number().int(),
  /** Cupons pegos aguardando uso (dentro do prazo). */
  activeClaims: z.number().int(),
  /** Economia estimada dos cupons usados neste mês (centavos). */
  savingsMonthCents: z.number().int(),
  /** Economia estimada de todos os cupons usados (centavos). */
  savingsTotalCents: z.number().int(),
});
export type MonthSummary = z.infer<typeof monthSummarySchema>;

export const sessionSchema = z.object({
  accessToken: z.string(),
  /** Segundos até o access token expirar. */
  expiresIn: z.number().int(),
  refreshToken: z.string(),
  refreshExpiresAt: isoDateTimeSchema,
  visitor: visitorProfileSchema,
});
export type Session = z.infer<typeof sessionSchema>;

export const meSchema = z.object({
  visitor: visitorProfileSchema,
  summary: monthSummarySchema,
});
export type Me = z.infer<typeof meSchema>;

export const updateMeBodySchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: phone.nullable().optional(),
  marketingOptIn: z.boolean().optional(),
});
export type UpdateMeBody = z.infer<typeof updateMeBodySchema>;

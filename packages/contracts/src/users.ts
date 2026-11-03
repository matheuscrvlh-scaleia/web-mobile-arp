import { z } from "zod";
import { passwordSchema } from "./auth";
import {
  idSchema,
  isoDateTimeSchema,
  listOf,
  paginated,
  paginationQuerySchema,
  refSchema,
} from "./common";
import { permissionSchema } from "./permissions";

/* Cargos ----------------------------------------------------------------- */

export const roleSchema = z.object({
  id: idSchema,
  name: z.string(),
  description: z.string().nullable(),
  permissions: z.array(permissionSchema),
  /** Cargo do sistema (Administrador): não pode ser apagado nem perder permissões. */
  isSystem: z.boolean(),
  usersCount: z.number().int(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type Role = z.infer<typeof roleSchema>;
export const roleListSchema = listOf(roleSchema);

export const createRoleBodySchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(240).nullable().optional(),
  permissions: z.array(permissionSchema).max(100),
});
export type CreateRoleBody = z.infer<typeof createRoleBodySchema>;

export const updateRoleBodySchema = createRoleBodySchema.partial();
export type UpdateRoleBody = z.infer<typeof updateRoleBodySchema>;

/* Usuários do painel ----------------------------------------------------- */

export const userStatusSchema = z.enum(["active", "disabled"]);
export type UserStatus = z.infer<typeof userStatusSchema>;

export const userSchema = z.object({
  id: idSchema,
  name: z.string(),
  email: z.string(),
  status: userStatusSchema,
  role: refSchema,
  store: refSchema.nullable(),
  mustChangePassword: z.boolean(),
  lastLoginAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type User = z.infer<typeof userSchema>;
export const userPageSchema = paginated(userSchema);

export const listUsersQuerySchema = paginationQuerySchema.extend({
  roleId: idSchema.optional(),
  storeId: idSchema.optional(),
  status: userStatusSchema.optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const createUserBodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().trim().toLowerCase(),
  roleId: idSchema,
  storeId: idSchema.nullable().optional(),
  /** Sem senha: o sistema gera uma provisória, devolvida uma única vez. */
  password: passwordSchema.optional(),
});
export type CreateUserBody = z.infer<typeof createUserBodySchema>;

export const createUserResponseSchema = z.object({
  user: userSchema,
  temporaryPassword: z.string().nullable(),
});
export type CreateUserResponse = z.infer<typeof createUserResponseSchema>;

export const updateUserBodySchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.email().trim().toLowerCase().optional(),
  roleId: idSchema.optional(),
  storeId: idSchema.nullable().optional(),
  status: userStatusSchema.optional(),
});
export type UpdateUserBody = z.infer<typeof updateUserBodySchema>;

/** Sem senha: o sistema gera uma provisória. Com senha: vale a escolhida pelo admin (também provisória). */
export const resetPasswordBodySchema = z.object({ password: passwordSchema.optional() }).optional();
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;

export const resetPasswordResponseSchema = z.object({ temporaryPassword: z.string() });
export type ResetPasswordResponse = z.infer<typeof resetPasswordResponseSchema>;

/* Cadastro de lojista pelo link (Fase 2) --------------------------------- */

/** A ARP gera um link para a loja; quem abre se cadastra e espera a aprovação. */
export const createMerchantInviteBodySchema = z.object({ storeId: idSchema });
export type CreateMerchantInviteBody = z.infer<typeof createMerchantInviteBodySchema>;

export const merchantInviteSchema = z.object({
  /** Vai no fim do link (/cadastro-lojista/<token>). Só aparece aqui, uma vez. */
  token: z.string(),
  store: refSchema,
  expiresAt: isoDateTimeSchema,
});
export type MerchantInvite = z.infer<typeof merchantInviteSchema>;

export const merchantInviteTokenParamsSchema = z.object({ token: z.string().min(16).max(128) });

/** O que a página pública do link mostra antes do cadastro. */
export const merchantInvitationSchema = z.object({
  store: refSchema,
  expiresAt: isoDateTimeSchema,
});
export type MerchantInvitation = z.infer<typeof merchantInvitationSchema>;

export const merchantSignupBodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().trim().toLowerCase(),
  /** WhatsApp para o aviso de aprovação. */
  phone: z.string().trim().min(8).max(20).nullable().default(null),
  password: passwordSchema,
});
export type MerchantSignupBody = z.infer<typeof merchantSignupBodySchema>;

export const merchantSignupStatusSchema = z.enum(["pending", "approved", "rejected"]);
export type MerchantSignupStatus = z.infer<typeof merchantSignupStatusSchema>;

export const merchantSignupSchema = z.object({
  id: idSchema,
  store: refSchema,
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  status: merchantSignupStatusSchema,
  createdAt: isoDateTimeSchema,
  decidedAt: isoDateTimeSchema.nullable(),
});
export type MerchantSignup = z.infer<typeof merchantSignupSchema>;
export const merchantSignupListSchema = listOf(merchantSignupSchema);
export const listMerchantSignupsQuerySchema = z.object({
  status: merchantSignupStatusSchema.optional(),
});
export type ListMerchantSignupsQuery = z.infer<typeof listMerchantSignupsQuerySchema>;

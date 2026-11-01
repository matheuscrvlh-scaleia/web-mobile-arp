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

export const resetPasswordResponseSchema = z.object({ temporaryPassword: z.string() });
export type ResetPasswordResponse = z.infer<typeof resetPasswordResponseSchema>;

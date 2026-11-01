import { z } from "zod";
import {
  booleanQuerySchema,
  hexColorSchema,
  iconNameSchema,
  idSchema,
  listOf,
  paginated,
  paginationQuerySchema,
} from "../common";
import { mapShapeSchema, storeHoursSchema, storeKindSchema } from "../directory";
import { challengeItemSchema } from "./challenges";
import { couponCardSchema } from "./coupons";

/* Guia de lojas e mapa (navegação livre, sem login). */

export const storeCategorySchema = z.object({
  id: idSchema,
  name: z.string(),
  kind: storeKindSchema,
  icon: iconNameSchema,
});
export type StoreCategory = z.infer<typeof storeCategorySchema>;
export const storeCategoryListSchema = listOf(storeCategorySchema);

export const storeSummarySchema = z.object({
  id: idSchema,
  slug: z.string(),
  name: z.string(),
  category: z.object({ id: idSchema, name: z.string(), kind: storeKindSchema }),
  floor: z.object({ id: idSchema, label: z.string(), shortLabel: z.string(), level: z.number() }),
  block: z.object({ id: idSchema, name: z.string() }),
  icon: iconNameSchema,
  brandColor: hexColorSchema,
  coverImageUrl: z.string().nullable(),
  /** Calculado no fuso America/Sao_Paulo a partir dos horários. */
  isOpenNow: z.boolean(),
  activeCouponsCount: z.number().int(),
  /** false sem login. */
  isFavorite: z.boolean(),
});
export type StoreSummary = z.infer<typeof storeSummarySchema>;
export const storePageSchema = paginated(storeSummarySchema);

export const listStoresQuerySchema = paginationQuerySchema.extend({
  kind: storeKindSchema.optional(),
  categoryId: idSchema.optional(),
  floorId: idSchema.optional(),
  /** Só lojas abertas agora (horário de America/Sao_Paulo). */
  openNow: booleanQuerySchema.optional(),
});
export type ListStoresQuery = z.infer<typeof listStoresQuerySchema>;

/** Loja por id ou slug (links arp://loja/<slug>). */
export const storeParamsSchema = z.object({ idOrSlug: z.string().trim().min(2).max(80) });

export const storeDetailSchema = storeSummarySchema.extend({
  description: z.string(),
  logoUrl: z.string().nullable(),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  instagram: z.string().nullable(),
  website: z.string().nullable(),
  mapX: z.number().nullable(),
  mapY: z.number().nullable(),
  hours: z.array(storeHoursSchema),
  /** Cupons no ar da loja. */
  coupons: z.array(couponCardSchema),
  /** Desafio da campanha no ar ligado à loja (se houver). */
  challenge: challengeItemSchema.nullable(),
  /** "Avisar ofertas". false sem login. */
  isFollowing: z.boolean(),
});
export type StoreDetail = z.infer<typeof storeDetailSchema>;

/* Mapa ------------------------------------------------------------------- */

export const mapSchema = z.object({
  floors: z.array(
    z.object({
      id: idSchema,
      level: z.number().int(),
      label: z.string(),
      shortLabel: z.string(),
      layout: z.array(mapShapeSchema),
      points: z.array(
        z.object({
          id: idSchema,
          icon: iconNameSchema,
          label: z.string(),
          x: z.number(),
          y: z.number(),
        }),
      ),
      pins: z.array(
        z.object({
          storeId: idSchema,
          slug: z.string(),
          name: z.string(),
          icon: iconNameSchema,
          brandColor: hexColorSchema,
          kind: storeKindSchema,
          x: z.number(),
          y: z.number(),
        }),
      ),
    }),
  ),
});
export type MapData = z.infer<typeof mapSchema>;

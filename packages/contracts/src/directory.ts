import { z } from "zod";
import {
  hexColorSchema,
  iconNameSchema,
  idSchema,
  isoDateTimeSchema,
  listOf,
  mediaUrlSchema,
  paginated,
  paginationQuerySchema,
  patchOf,
  slugSchema,
  timeOfDaySchema,
  urlSchema,
} from "./common";

/** Desenho do mapa: coordenadas no viewBox 360 x 470 do app. */
export const MAP_VIEWBOX = { width: 360, height: 470 } as const;
const mapX = z.number().min(0).max(MAP_VIEWBOX.width);
const mapY = z.number().min(0).max(MAP_VIEWBOX.height);

export const storeKindSchema = z.enum(["food", "shop"]);
export type StoreKind = z.infer<typeof storeKindSchema>;

export const STORE_KIND_LABEL: Record<StoreKind, string> = {
  food: "Alimentação",
  shop: "Lojas e serviços",
};

/* Andares ---------------------------------------------------------------- */

export const mapShapeKindSchema = z.enum([
  "block",
  "plaza",
  "parking",
  "bridge",
  "void",
  "terrace",
]);
export type MapShapeKind = z.infer<typeof mapShapeKindSchema>;

export const mapShapeSchema = z.object({
  kind: mapShapeKindSchema,
  label: z.string().trim().max(40),
  x: mapX,
  y: mapY,
  w: z.number().min(1).max(MAP_VIEWBOX.width),
  h: z.number().min(1).max(MAP_VIEWBOX.height),
});
export type MapShape = z.infer<typeof mapShapeSchema>;

export const floorSchema = z.object({
  id: idSchema,
  /** 0 = térreo, 1 = 1º andar… (negativo = subsolo). Único. */
  level: z.number().int(),
  label: z.string(),
  shortLabel: z.string(),
  layout: z.array(mapShapeSchema),
  storesCount: z.number().int(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type Floor = z.infer<typeof floorSchema>;
export const floorListSchema = listOf(floorSchema);

export const createFloorBodySchema = z.object({
  level: z.number().int().min(-5).max(50),
  label: z.string().trim().min(1).max(40),
  shortLabel: z.string().trim().min(1).max(3),
  layout: z.array(mapShapeSchema).max(60).default([]),
});
export type CreateFloorBody = z.infer<typeof createFloorBodySchema>;
export const updateFloorBodySchema = z.object(patchOf(createFloorBodySchema.shape));
export type UpdateFloorBody = z.infer<typeof updateFloorBodySchema>;

/* Blocos ----------------------------------------------------------------- */

export const blockSchema = z.object({
  id: idSchema,
  name: z.string(),
  sortOrder: z.number().int(),
  storesCount: z.number().int(),
});
export type Block = z.infer<typeof blockSchema>;
export const blockListSchema = listOf(blockSchema);

export const createBlockBodySchema = z.object({
  name: z.string().trim().min(1).max(40),
  sortOrder: z.number().int().min(0).max(999).default(0),
});
export type CreateBlockBody = z.infer<typeof createBlockBodySchema>;
export const updateBlockBodySchema = z.object(patchOf(createBlockBodySchema.shape));
export type UpdateBlockBody = z.infer<typeof updateBlockBodySchema>;

/* Categorias de loja ----------------------------------------------------- */

export const storeCategorySchema = z.object({
  id: idSchema,
  name: z.string(),
  kind: storeKindSchema,
  icon: iconNameSchema,
  sortOrder: z.number().int(),
  storesCount: z.number().int(),
});
export type StoreCategory = z.infer<typeof storeCategorySchema>;
export const storeCategoryListSchema = listOf(storeCategorySchema);

export const createStoreCategoryBodySchema = z.object({
  name: z.string().trim().min(2).max(40),
  kind: storeKindSchema,
  icon: iconNameSchema,
  sortOrder: z.number().int().min(0).max(999).default(0),
});
export type CreateStoreCategoryBody = z.infer<typeof createStoreCategoryBodySchema>;
export const updateStoreCategoryBodySchema = z.object(patchOf(createStoreCategoryBodySchema.shape));
export type UpdateStoreCategoryBody = z.infer<typeof updateStoreCategoryBodySchema>;

/* Pontos do mapa (reciclagem, estacionamento, início do tour…) ----------- */

export const mapPointSchema = z.object({
  id: idSchema,
  floorId: idSchema,
  icon: iconNameSchema,
  label: z.string(),
  x: z.number(),
  y: z.number(),
});
export type MapPoint = z.infer<typeof mapPointSchema>;
export const mapPointListSchema = listOf(mapPointSchema);

export const createMapPointBodySchema = z.object({
  floorId: idSchema,
  icon: iconNameSchema,
  label: z.string().trim().min(2).max(60),
  x: mapX,
  y: mapY,
});
export type CreateMapPointBody = z.infer<typeof createMapPointBodySchema>;
export const updateMapPointBodySchema = z.object(patchOf(createMapPointBodySchema.shape));
export type UpdateMapPointBody = z.infer<typeof updateMapPointBodySchema>;

export const listMapPointsQuerySchema = z.object({ floorId: idSchema.optional() });

/* Lojas ------------------------------------------------------------------ */

export const storeStatusSchema = z.enum(["active", "inactive"]);
export type StoreStatus = z.infer<typeof storeStatusSchema>;

/**
 * Horário de um dia da semana (0 = domingo). Fechar antes de abrir
 * significa que passa da meia-noite (ex.: 16:00 às 00:30). Dia ausente
 * na lista = fechado.
 */
export const storeHoursSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    opensAt: timeOfDaySchema,
    closesAt: timeOfDaySchema,
  })
  .refine((h) => h.opensAt !== h.closesAt, {
    message: "Abertura e fechamento não podem ser iguais",
    path: ["closesAt"],
  });
export type StoreHours = z.infer<typeof storeHoursSchema>;

export const storeHoursListSchema = z
  .array(storeHoursSchema)
  .max(7)
  .refine((l) => new Set(l.map((h) => h.weekday)).size === l.length, "Dia da semana repetido");

export const storeSummarySchema = z.object({
  id: idSchema,
  slug: z.string(),
  name: z.string(),
  category: z.object({ id: idSchema, name: z.string(), kind: storeKindSchema }),
  block: z.object({ id: idSchema, name: z.string() }),
  floor: z.object({ id: idSchema, label: z.string(), shortLabel: z.string(), level: z.number() }),
  icon: iconNameSchema,
  brandColor: hexColorSchema,
  coverImageUrl: z.string().nullable(),
  status: storeStatusSchema,
  activeCouponsCount: z.number().int(),
  /** Calculado no fuso America/Sao_Paulo a partir dos horários. */
  isOpenNow: z.boolean(),
  /** Posição do pino no desenho do andar (null = ainda sem posição). */
  mapX: z.number().nullable(),
  mapY: z.number().nullable(),
});
export type StoreSummary = z.infer<typeof storeSummarySchema>;
export const storePageSchema = paginated(storeSummarySchema);

export const storeDetailSchema = storeSummarySchema.extend({
  description: z.string(),
  logoUrl: z.string().nullable(),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  instagram: z.string().nullable(),
  website: z.string().nullable(),
  hours: z.array(storeHoursSchema),
  followersCount: z.number().int(),
  favoritesCount: z.number().int(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type StoreDetail = z.infer<typeof storeDetailSchema>;

const phone = z
  .string()
  .trim()
  .max(20)
  .regex(/^[\d\s()+-]*$/, "Telefone inválido");

export const createStoreBodySchema = z.object({
  name: z.string().trim().min(2).max(80),
  /** Sem slug: gerado a partir do nome. */
  slug: slugSchema.optional(),
  categoryId: idSchema,
  blockId: idSchema,
  floorId: idSchema,
  description: z.string().trim().max(600).default(""),
  icon: iconNameSchema,
  brandColor: hexColorSchema,
  coverImageUrl: mediaUrlSchema.nullable().optional(),
  logoUrl: mediaUrlSchema.nullable().optional(),
  phone: phone.nullable().optional(),
  whatsapp: phone.nullable().optional(),
  instagram: z.string().trim().max(60).nullable().optional(),
  website: urlSchema.nullable().optional(),
  mapX: mapX.nullable().optional(),
  mapY: mapY.nullable().optional(),
  hours: storeHoursListSchema.default([]),
  status: storeStatusSchema.default("active"),
});
export type CreateStoreBody = z.infer<typeof createStoreBodySchema>;
export type CreateStoreInput = z.input<typeof createStoreBodySchema>;

export const updateStoreBodySchema = z.object(patchOf(createStoreBodySchema.shape));
export type UpdateStoreBody = z.infer<typeof updateStoreBodySchema>;

export const listStoresQuerySchema = paginationQuerySchema.extend({
  kind: storeKindSchema.optional(),
  categoryId: idSchema.optional(),
  blockId: idSchema.optional(),
  floorId: idSchema.optional(),
  status: storeStatusSchema.optional(),
});
export type ListStoresQuery = z.infer<typeof listStoresQuerySchema>;

/**
 * Posiciona a loja no mapa (permissão map.manage, separada da edição da
 * loja). Trocar o andar sem coordenadas zera o pino.
 */
export const updateStoreLocationBodySchema = z.object({
  floorId: idSchema.optional(),
  mapX: mapX.nullable(),
  mapY: mapY.nullable(),
});
export type UpdateStoreLocationBody = z.infer<typeof updateStoreLocationBodySchema>;

/** Lista enxuta para selects (todas as lojas ativas). */
export const storeOptionSchema = z.object({
  id: idSchema,
  name: z.string(),
  icon: iconNameSchema,
  brandColor: hexColorSchema,
  kind: storeKindSchema,
});
export type StoreOption = z.infer<typeof storeOptionSchema>;
export const storeOptionListSchema = listOf(storeOptionSchema);

/**
 * Loja no editor do mapa: só o que o pino e a lista do andar mostram.
 * `GET /floors/:id/pins` devolve TODAS as lojas do andar (sem paginação),
 * inclusive as inativas e as ainda sem posição (mapX/mapY null).
 */
export const storePinSchema = storeSummarySchema.pick({
  id: true,
  name: true,
  icon: true,
  brandColor: true,
  status: true,
  category: true,
  block: true,
  mapX: true,
  mapY: true,
});
export type StorePin = z.infer<typeof storePinSchema>;
export const storePinListSchema = listOf(storePinSchema);

/* Painel do lojista ------------------------------------------------------ */

export const metricsPeriodSchema = z.enum(["today", "7d", "30d", "90d"]);
export type MetricsPeriod = z.infer<typeof metricsPeriodSchema>;

export const storeMetricsQuerySchema = z.object({
  period: metricsPeriodSchema.default("30d"),
});

export const storeMetricsSchema = z.object({
  period: metricsPeriodSchema,
  coupons: z.object({
    /** Soma dos estoques das promoções ativas. */
    released: z.number().int(),
    claimed: z.number().int(),
    waiting: z.number().int(),
    redeemed: z.number().int(),
    /** Pegos que venceram sem uso e voltaram para a promoção. */
    returned: z.number().int(),
  }),
  redemptionsByHour: z.array(z.object({ hour: z.number().int(), count: z.number().int() })),
  lastRedemptions: z.array(
    z.object({ code: z.string(), couponTitle: z.string(), redeemedAt: isoDateTimeSchema }),
  ),
  followersCount: z.number().int(),
  favoritesCount: z.number().int(),
});
export type StoreMetrics = z.infer<typeof storeMetricsSchema>;

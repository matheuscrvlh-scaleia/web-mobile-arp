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

/**
 * As 3 categorias do app (Fase 2), sempre nesta ordem: Lojas, Gastronomia e
 * Serviços. As subcategorias (as mesmas do site da ARP) são as
 * store_categories de cada tipo. Chaves estáveis: shop/food/service.
 */
export const storeKindSchema = z.enum(["shop", "food", "service"]);
export type StoreKind = z.infer<typeof storeKindSchema>;

export const STORE_KIND_LABEL: Record<StoreKind, string> = {
  shop: "Lojas",
  food: "Gastronomia",
  service: "Serviços",
};

/** Ícone de cada categoria nos atalhos e abas. */
export const STORE_KIND_ICON: Record<StoreKind, string> = {
  shop: "shopping-bag",
  food: "utensils",
  service: "briefcase",
};

/** Referência à subcategoria (id, nome e a qual das 3 categorias pertence). */
export const storeCategoryRefSchema = z.object({
  id: idSchema,
  name: z.string(),
  kind: storeKindSchema,
});
export type StoreCategoryRef = z.infer<typeof storeCategoryRefSchema>;

/** Até quantas subcategorias extras um estabelecimento pode ter (além da principal). */
export const STORE_EXTRA_CATEGORIES_MAX = 5;

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
  /** Forma "Bloco" ligada ao cadastro de blocos (lojas do bloco, sugestão ao posicionar). */
  blockId: idSchema.nullable().optional(),
});
export type MapShape = z.infer<typeof mapShapeSchema>;

export const floorSchema = z.object({
  id: idSchema,
  /** 0 = 1º andar, 1 = 2º andar… (negativo = subsolo). Único. O app nunca diz "Térreo". */
  level: z.number().int(),
  label: z.string(),
  shortLabel: z.string(),
  layout: z.array(mapShapeSchema),
  /** Planta do andar (só no painel, de fundo para desenhar por cima). */
  backgroundImageUrl: z.string().nullable(),
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
  backgroundImageUrl: mediaUrlSchema.nullable().optional(),
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

/** Nova ordem de um cadastro (blocos, categorias de um tipo): ids na ordem da tela. */
export const catalogOrderBodySchema = z.object({
  ids: z
    .array(idSchema)
    .min(1)
    .max(300)
    .refine((l) => new Set(l).size === l.length, "Item repetido"),
});
export type CatalogOrderBody = z.infer<typeof catalogOrderBodySchema>;

/** Apagar bloco/categoria em uso: `moveTo` leva as lojas para outro antes de apagar. */
export const catalogRemoveQuerySchema = z.object({ moveTo: idSchema.optional() });
export type CatalogRemoveQuery = z.infer<typeof catalogRemoveQuerySchema>;

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

/** Até quantos intervalos por dia (ex.: almoço 11–15h e jantar 18–23h). */
export const STORE_HOURS_PER_DAY_MAX = 3;

const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/**
 * Dias com intervalos que se cruzam (o que passa da meia-noite conta até o
 * fim do dia). Vazio = tudo certo.
 */
export function overlappingWeekdays(
  hours: readonly { weekday: number; opensAt: string; closesAt: string }[],
): number[] {
  const bad: number[] = [];
  for (let day = 0; day < 7; day++) {
    const spans = hours
      .filter((h) => h.weekday === day)
      .map((h) => {
        const start = toMinutes(h.opensAt);
        const end = toMinutes(h.closesAt);
        return { start, end: end > start ? end : 24 * 60 };
      })
      .sort((a, b) => a.start - b.start);
    if (spans.some((s, i) => i > 0 && s.start < (spans[i - 1]?.end ?? 0))) bad.push(day);
  }
  return bad;
}

export const storeHoursListSchema = z
  .array(storeHoursSchema)
  .max(7 * STORE_HOURS_PER_DAY_MAX)
  .refine(
    (l) =>
      [0, 1, 2, 3, 4, 5, 6].every(
        (d) => l.filter((h) => h.weekday === d).length <= STORE_HOURS_PER_DAY_MAX,
      ),
    `Até ${STORE_HOURS_PER_DAY_MAX} horários por dia`,
  )
  .refine((l) => overlappingWeekdays(l).length === 0, "Dois horários do mesmo dia se cruzam");

/**
 * O que falta no cadastro da loja (filtro "Pendências" e completude):
 * horário, foto de capa, logo, lugar no mapa e descrição.
 */
export const storeGapSchema = z.enum(["hours", "cover", "logo", "map", "description"]);
export type StoreGap = z.infer<typeof storeGapSchema>;
export const STORE_GAP_LABEL: Record<StoreGap, string> = {
  hours: "horário",
  cover: "foto de capa",
  logo: "logo",
  map: "lugar no mapa",
  description: "descrição",
};

export const storeSummarySchema = z.object({
  id: idSchema,
  slug: z.string(),
  name: z.string(),
  /** Subcategoria principal. */
  category: storeCategoryRefSchema,
  /**
   * Subcategorias extras (ex.: loja de roupas que também é café). A loja
   * aparece em todas as categorias marcadas.
   */
  extraCategories: z.array(storeCategoryRefSchema),
  block: z.object({ id: idSchema, name: z.string() }),
  floor: z.object({ id: idSchema, label: z.string(), shortLabel: z.string(), level: z.number() }),
  icon: iconNameSchema,
  brandColor: hexColorSchema,
  coverImageUrl: z.string().nullable(),
  status: storeStatusSchema,
  activeCouponsCount: z.number().int(),
  /** Calculado no fuso America/Sao_Paulo a partir dos horários. */
  isOpenNow: z.boolean(),
  /** false = nenhum horário cadastrado ("Sem horário", não "Fechada agora"). */
  hasHours: z.boolean(),
  /** Itens do cadastro que faltam (vazio = completa). */
  missing: z.array(storeGapSchema),
  /** Posição do pino no desenho do andar (null = ainda sem posição). */
  mapX: z.number().nullable(),
  mapY: z.number().nullable(),
  updatedAt: isoDateTimeSchema,
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
  /**
   * Histórico ligado à loja. Com qualquer um deles a loja não pode ser
   * excluída (só desativada).
   */
  usage: z.object({
    coupons: z.number().int(),
    challenges: z.number().int(),
    events: z.number().int(),
    highlights: z.number().int(),
    notifications: z.number().int(),
    jobs: z.number().int(),
    merchants: z.number().int(),
  }),
  createdAt: isoDateTimeSchema,
});
export type StoreDetail = z.infer<typeof storeDetailSchema>;

const phone = z
  .string()
  .trim()
  .max(20)
  .regex(/^[\d\s()+-]*$/, "Telefone inválido");

export const createStoreBodySchema = z.object({
  name: z.string().trim().min(2, "Escreva o nome da loja").max(80),
  /** Sem slug: gerado a partir do nome. */
  slug: slugSchema.optional(),
  /** Subcategoria principal. */
  categoryId: z.uuid({ error: "Escolha a categoria" }),
  /** Outras subcategorias (podem ser de outra das 3 categorias). */
  extraCategoryIds: z
    .array(idSchema)
    .max(STORE_EXTRA_CATEGORIES_MAX)
    .refine((l) => new Set(l).size === l.length, "Categoria repetida")
    .default([]),
  blockId: z.uuid({ error: "Escolha o bloco" }),
  floorId: z.uuid({ error: "Escolha o andar" }),
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

export const storeSortSchema = z.enum(["name", "category", "block", "floor", "updated"]);
export type StoreSort = z.infer<typeof storeSortSchema>;

export const listStoresQuerySchema = paginationQuerySchema.extend({
  kind: storeKindSchema.optional(),
  categoryId: idSchema.optional(),
  blockId: idSchema.optional(),
  floorId: idSchema.optional(),
  status: storeStatusSchema.optional(),
  /** Pendências: lojas sem o item (ou "any" = com qualquer pendência). */
  missing: z.union([storeGapSchema, z.literal("any")]).optional(),
  sort: storeSortSchema.optional(),
  order: z.enum(["asc", "desc"]).optional(),
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

/**
 * Ação em lote na lista de lojas: muda categoria, bloco, andar e/ou
 * situação de várias lojas de uma vez. Trocar o andar tira a loja do mapa
 * (a posição antiga é de outro desenho).
 */
export const bulkUpdateStoresBodySchema = z.object({
  ids: z
    .array(idSchema)
    .min(1, "Escolha pelo menos uma loja")
    .max(200)
    .refine((l) => new Set(l).size === l.length, "Loja repetida"),
  changes: z
    .object({
      categoryId: idSchema.optional(),
      blockId: idSchema.optional(),
      floorId: idSchema.optional(),
      status: storeStatusSchema.optional(),
    })
    .refine((c) => Object.values(c).some((v) => v !== undefined), "Escolha o que mudar"),
});
export type BulkUpdateStoresBody = z.infer<typeof bulkUpdateStoresBodySchema>;
export const bulkUpdateStoresResponseSchema = z.object({ updated: z.number().int() });
export type BulkUpdateStoresResponse = z.infer<typeof bulkUpdateStoresResponseSchema>;

/** Lista enxuta para selects (todas as lojas ativas). */
export const storeOptionSchema = z.object({
  id: idSchema,
  name: z.string(),
  icon: iconNameSchema,
  brandColor: hexColorSchema,
  kind: storeKindSchema,
  /** Onde fica (texto secundário do StoreSelect): "1º andar", "Bloco A". */
  floorLabel: z.string().optional(),
  blockName: z.string().optional(),
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

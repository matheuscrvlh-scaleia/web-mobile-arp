import { z } from "zod";
import { idSchema } from "../common";
import { highlightBadgeSchema, highlightTargetSchema } from "../marketing";
import { eventCardSchema } from "./agenda";
import { monthSummarySchema } from "./auth";
import { couponCardSchema } from "./coupons";

/** Destaque do carrossel (publicado e no ar), na ordem definida no painel. */
export const highlightSchema = z.object({
  id: idSchema,
  title: z.string(),
  subtitle: z.string().nullable(),
  ctaLabel: z.string().nullable(),
  imageUrl: z.string().nullable(),
  badge: highlightBadgeSchema,
  targetType: highlightTargetSchema,
  targetId: idSchema.nullable(),
  targetLabel: z.string().nullable(),
  /** Slug da loja quando targetType = "store" (abre a página da loja sem outra chamada). */
  targetSlug: z.string().nullable(),
  targetUrl: z.string().nullable(),
});
export type Highlight = z.infer<typeof highlightSchema>;

export const homeSchema = z.object({
  highlights: z.array(highlightSchema),
  /** Cupons no ar com estoque, dos mais perto de acabar (proporcionalmente). */
  endingCoupons: z.array(couponCardSchema),
  /** Cupons no ar agora (o mesmo total da lista de cupons sem filtro). */
  activeCouponsCount: z.number().int(),
  /** Próximos eventos publicados (a partir de hoje). */
  upcomingEvents: z.array(eventCardSchema),
  /** Resumo do mês do visitante logado (null sem login). */
  summary: monthSummarySchema.nullable(),
});
export type Home = z.infer<typeof homeSchema>;

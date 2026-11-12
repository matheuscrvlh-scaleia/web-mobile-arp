import { z } from "zod";
import {
  hexColorSchema,
  iconNameSchema,
  idSchema,
  isoDateTimeSchema,
  listOf,
  mediaUrlSchema,
  patchOf,
} from "./common";

/*
 * Conteúdo da ARP (Fase 2): Circuito Cultural, Sustentarp, textos
 * (história, regras, regulamento do Clube) e vagas de emprego. O painel
 * edita; o app só lê.
 */

/* Textos ------------------------------------------------------------------ */

/**
 * history = Nossa história · rules = Regras da ARP (com PDF) ·
 * club_rules = Regulamento do Clube ARP · circuit = abertura do Circuito
 * Cultural (o arquivo é a imagem do mapa do Circuito) · history_full = Nossa
 * história completa (o "Saiba mais"; o arquivo é a foto do topo) · sustentarp =
 * abertura do Sustentarp (o arquivo é a foto do topo) · sustentarp_friend =
 * Seja um Amigo do Sustentarp (o arquivo é o formulário ou PDF).
 */
export const contentPageKeySchema = z.enum([
  "history",
  "rules",
  "club_rules",
  "circuit",
  "history_full",
  "sustentarp",
  "sustentarp_friend",
]);
export type ContentPageKey = z.infer<typeof contentPageKeySchema>;

export const CONTENT_PAGE_LABEL: Record<ContentPageKey, string> = {
  history: "Nossa história",
  rules: "Regras da ARP",
  club_rules: "Regulamento do Clube ARP",
  circuit: "Circuito Cultural",
  history_full: "Nossa história (completa)",
  sustentarp: "Sustentarp",
  sustentarp_friend: "Seja um Amigo do Sustentarp",
};

export const contentPageSchema = z.object({
  key: contentPageKeySchema,
  title: z.string(),
  /** Texto corrido; parágrafos separados por linha em branco. */
  body: z.string(),
  /** PDF para baixar (regras) ou imagem do mapa (circuit). */
  fileUrl: z.string().nullable(),
  updatedAt: isoDateTimeSchema.nullable(),
});
export type ContentPage = z.infer<typeof contentPageSchema>;
export const contentPageListSchema = listOf(contentPageSchema);
export const contentPageKeyParamsSchema = z.object({ key: contentPageKeySchema });

export const updateContentPageBodySchema = z.object({
  title: z.string().trim().min(1, "Escreva o título").max(120, "Use até 120 letras").optional(),
  body: z.string().trim().max(20_000).optional(),
  fileUrl: mediaUrlSchema.nullable().optional(),
});
export type UpdateContentPageBody = z.infer<typeof updateContentPageBodySchema>;

/* Circuito Cultural ------------------------------------------------------- */

export const artPointKindSchema = z.enum(["work", "memory", "sculpture", "mural"]);
export type ArtPointKind = z.infer<typeof artPointKindSchema>;

export const ART_POINT_KIND_LABEL: Record<ArtPointKind, string> = {
  work: "Obra",
  memory: "Memória",
  sculpture: "Escultura",
  mural: "Mural e grafite",
};

export const artPointSchema = z.object({
  id: idSchema,
  /** Número do ponto no mapa do Circuito. */
  number: z.number().int(),
  name: z.string(),
  artist: z.string(),
  place: z.string(),
  kind: artPointKindSchema,
  description: z.string(),
  imageUrl: z.string().nullable(),
  /** Posição no mapa do Circuito, em % (0–100); null = ainda sem posição. */
  mapX: z.number().nullable(),
  mapY: z.number().nullable(),
  active: z.boolean(),
});
export type ArtPoint = z.infer<typeof artPointSchema>;
export const artPointListSchema = listOf(artPointSchema);

const percent = z.number().min(0).max(100);

export const createArtPointBodySchema = z.object({
  number: z.number().int().min(1).max(999),
  name: z.string().trim().min(1, "Dê um nome ao ponto").max(120, "Use até 120 letras"),
  artist: z.string().trim().max(120).default(""),
  place: z.string().trim().max(160).default(""),
  kind: artPointKindSchema,
  description: z.string().trim().max(600).default(""),
  imageUrl: mediaUrlSchema.nullable().default(null),
  mapX: percent.nullable().default(null),
  mapY: percent.nullable().default(null),
  active: z.boolean().default(true),
});
export type CreateArtPointBody = z.infer<typeof createArtPointBodySchema>;
export const updateArtPointBodySchema = z.object(patchOf(createArtPointBodySchema.shape));
export type UpdateArtPointBody = z.infer<typeof updateArtPointBodySchema>;

/* Sustentarp -------------------------------------------------------------- */

export const recyclingItemSchema = z.object({
  id: idSchema,
  name: z.string(),
  icon: iconNameSchema,
  /** O que pode ser descartado. */
  accepts: z.string(),
  /** O que não pode. */
  rejects: z.string(),
  /** O que vira depois. */
  becomes: z.string(),
  /** Descarte deste item conta para o desafio que dá selo. */
  givesSeal: z.boolean(),
  sortOrder: z.number().int(),
  active: z.boolean(),
});
export type RecyclingItem = z.infer<typeof recyclingItemSchema>;
export const recyclingItemListSchema = listOf(recyclingItemSchema);

export const createRecyclingItemBodySchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao item").max(80, "Use até 80 letras"),
  icon: iconNameSchema,
  accepts: z.string().trim().max(600).default(""),
  rejects: z.string().trim().max(600).default(""),
  becomes: z.string().trim().max(600).default(""),
  givesSeal: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(999).default(0),
  active: z.boolean().default(true),
});
export type CreateRecyclingItemBody = z.infer<typeof createRecyclingItemBodySchema>;
export const updateRecyclingItemBodySchema = z.object(patchOf(createRecyclingItemBodySchema.shape));
export type UpdateRecyclingItemBody = z.infer<typeof updateRecyclingItemBodySchema>;

/** Nova ordem do Sustentarp (arrastar): todos os ids, na ordem desejada. */
export const reorderRecyclingItemsBodySchema = z.object({ ids: z.array(idSchema).min(1).max(500) });
export type ReorderRecyclingItemsBody = z.infer<typeof reorderRecyclingItemsBodySchema>;

/* Vagas ------------------------------------------------------------------- */

/** Prazo padrão de uma vaga no ar (dias); a ARP muda em Configurações. */
export const JOB_DEFAULT_DAYS = 30;

export const jobSchema = z.object({
  id: idSchema,
  store: z.object({
    id: idSchema,
    slug: z.string(),
    name: z.string(),
    icon: iconNameSchema,
    brandColor: hexColorSchema,
  }),
  title: z.string(),
  /** Texto da vaga (ou só a imagem). */
  text: z.string(),
  imageUrl: z.string().nullable(),
  /** WhatsApp do lojista para candidatos (só dígitos, com DDD). */
  whatsapp: z.string(),
  publishedAt: isoDateTimeSchema,
  /** Sai do ar sozinha nesta data. */
  expiresAt: isoDateTimeSchema,
  /** No ar agora (não venceu). */
  isLive: z.boolean(),
});
export type Job = z.infer<typeof jobSchema>;
export const jobListSchema = listOf(jobSchema);

export const listJobsQuerySchema = z.object({
  storeId: idSchema.optional(),
  /** live = no ar; expired = já saíram do ar. */
  status: z.enum(["live", "expired"]).optional(),
});
export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>;

/** Dias no ar contados de agora (1–90). */
export const jobDaysSchema = z
  .number({ message: "Informe os dias" })
  .int("Só dias inteiros")
  .min(1, "Mínimo 1 dia")
  .max(90, "Máximo 90 dias");

/**
 * WhatsApp como a pessoa digita ("(22) 99999-0000", "+55 22 9…"): fica só
 * com os dígitos e põe o 55 do Brasil quando vem só com o DDD.
 */
export function normalizeWhatsapp(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

const jobFields = {
  title: z.string().trim().min(1, "Escreva o cargo").max(120),
  text: z.string().trim().max(1500).default(""),
  imageUrl: mediaUrlSchema.nullable().default(null),
  whatsapp: z
    .string()
    .trim()
    .min(1, "Informe o WhatsApp para os candidatos")
    .transform(normalizeWhatsapp)
    .pipe(z.string().regex(/^\d{12,13}$/, "WhatsApp com DDD, ex.: (22) 99999-0000")),
};
const NEEDS_TEXT_OR_IMAGE = {
  message: "Escreva o texto da vaga ou envie uma imagem",
  path: ["text"],
};

export const createJobBodySchema = z
  .object({
    storeId: z.uuid({ error: "Escolha a loja" }),
    ...jobFields,
    days: jobDaysSchema.default(JOB_DEFAULT_DAYS),
  })
  .refine((b) => b.text.length > 0 || b.imageUrl !== null, NEEDS_TEXT_OR_IMAGE);
export type CreateJobBody = z.infer<typeof createJobBodySchema>;

/** Edita a vaga (a loja não muda). `days` presente = sai do ar em N dias a partir de agora. */
export const updateJobBodySchema = z
  .object({ ...patchOf(jobFields), days: jobDaysSchema.optional() })
  .refine((b) => b.text !== "" || b.imageUrl !== null, NEEDS_TEXT_OR_IMAGE);
export type UpdateJobBody = z.infer<typeof updateJobBodySchema>;

import {
  type CreateHighlightBody,
  createHighlightBodySchema,
  type Highlight,
  type UpdateHighlightBody,
} from "@arp/contracts";
import type { z } from "zod";
import { copyName } from "@/shared/hooks";
import { addHours, nextRoundedNow } from "@/shared/lib/dates";
import { pickDirty } from "@/shared/lib/forms";

export const highlightFormSchema = createHighlightBodySchema;
export type HighlightFormInput = z.input<typeof highlightFormSchema>;
export type HighlightFormValues = z.output<typeof highlightFormSchema>;

export const HIGHLIGHT_FORM_FIELDS = [
  "title",
  "subtitle",
  "ctaLabel",
  "imageUrl",
  "badge",
  "targetType",
  "targetId",
  "targetUrl",
  "sponsorStoreId",
  "startsAt",
  "endsAt",
  "status",
] as const;

const TARGET_FIELDS = ["targetType", "targetId", "targetUrl"] as const;
const SPONSOR_FIELDS = ["badge", "sponsorStoreId"] as const;
const PERIOD_FIELDS = ["startsAt", "endsAt"] as const;

/** "arp.com.br/natal" vira "https://arp.com.br/natal" (ninguém digita o https). */
export function withHttps(url: string | null | undefined): string | null {
  const v = (url ?? "").trim();
  if (!v) return null;
  return /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v.replace(/^\/+/, "")}`;
}

/**
 * Valores do formulário. `copy` = "Duplicar": "(cópia)" no título, rascunho
 * e período novo (a partir da próxima hora, mesma duração). Destaque novo começa
 * agora (o botão diz "Publicar"; para agendar, basta mudar a data).
 */
export function highlightToFormValues(h?: Highlight, { copy = false } = {}): HighlightFormInput {
  const keep = h && !copy ? h : null;
  const startsAt = keep
    ? keep.startsAt
    : h
      ? nextRoundedNow(60)
      : new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
  const duration = h ? new Date(h.endsAt).getTime() - new Date(h.startsAt).getTime() : 0;
  const hours = duration > 0 ? Math.round(duration / 3_600_000) : 7 * 24;
  return {
    title: h ? (copy ? copyName(h.title) : h.title) : "",
    subtitle: h?.subtitle ?? null,
    ctaLabel: h?.ctaLabel ?? null,
    imageUrl: h?.imageUrl ?? null,
    badge: h?.badge ?? "featured",
    targetType: h?.targetType ?? "none",
    targetId: h?.targetId ?? null,
    targetUrl: h?.targetUrl ?? null,
    sponsorStoreId: h?.sponsorStore?.id ?? null,
    startsAt,
    endsAt: keep ? keep.endsAt : addHours(startsAt, hours),
    status: copy ? "draft" : (h?.status ?? "draft"),
  };
}

/** Zera o destino e o patrocinador que não valem para o que foi escolhido. */
export function cleanHighlight(v: HighlightFormValues): CreateHighlightBody {
  const needsId = v.targetType === "event" || v.targetType === "coupon" || v.targetType === "store";
  return {
    ...v,
    targetId: needsId ? (v.targetId ?? null) : null,
    targetUrl: v.targetType === "url" ? (v.targetUrl ?? null) : null,
    sponsorStoreId: v.badge === "sponsored" ? (v.sponsorStoreId ?? null) : null,
  };
}

/**
 * PATCH: só o que mudou, mas destino, patrocínio e período vão sempre
 * completos quando qualquer parte deles muda (a API valida o conjunto).
 */
export function highlightPatch(
  values: HighlightFormValues,
  dirty: Partial<Record<keyof HighlightFormValues, unknown>>,
): UpdateHighlightBody {
  const clean = cleanHighlight(values);
  const body: UpdateHighlightBody = pickDirty(clean, dirty);
  for (const group of [TARGET_FIELDS, SPONSOR_FIELDS, PERIOD_FIELDS]) {
    if (group.some((k) => dirty[k])) {
      for (const k of group) Object.assign(body, { [k]: clean[k] });
    }
  }
  return body;
}

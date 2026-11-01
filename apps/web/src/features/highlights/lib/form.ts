import {
  type CreateHighlightBody,
  createHighlightBodySchema,
  type Highlight,
  type UpdateHighlightBody,
} from "@arp/contracts";
import type { z } from "zod";
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

export function highlightToFormValues(h?: Highlight): HighlightFormInput {
  const startsAt = h?.startsAt ?? nextRoundedNow(60);
  return {
    title: h?.title ?? "",
    subtitle: h?.subtitle ?? null,
    ctaLabel: h?.ctaLabel ?? null,
    imageUrl: h?.imageUrl ?? null,
    badge: h?.badge ?? "featured",
    targetType: h?.targetType ?? "none",
    targetId: h?.targetId ?? null,
    targetUrl: h?.targetUrl ?? null,
    sponsorStoreId: h?.sponsorStore?.id ?? null,
    startsAt,
    endsAt: h?.endsAt ?? addHours(startsAt, 7 * 24),
    status: h?.status ?? "draft",
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

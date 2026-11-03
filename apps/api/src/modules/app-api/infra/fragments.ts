import type { App } from "@arp/contracts";
import { type SqlFragment, sql } from "../../../shared/infra/database/sql";
import { iso, isoOrNull } from "../../../shared/infra/presenters";
import { type ClaimStatus, walletStatusOf } from "../domain/wallet";

/*
 * Trechos de SQL e mapeadores reaproveitados pelas consultas do app. O app
 * só enxerga o que está no ar: loja ativa, cupom ativo dentro do período,
 * evento publicado, campanha publicada no período.
 */

type Tone = App.CouponCard["tone"];
type Kind = App.StoreRef["kind"];

/** Cupom no ar (exige os aliases c = cupom e s = loja). */
export const liveCoupon = (now: Date): SqlFragment => sql`
  c.status = 'active' and c.review = 'approved'
  and c.starts_at <= ${now} and (c.ends_at is null or c.ends_at > ${now})
  and s.status = 'active'
`;

/** Campanha publicada no ar agora (a mais recente, se houver sobreposição). */
export const liveCampaignId = (now: Date): SqlFragment => sql`(
  select id from gamification.campaigns
  where status = 'published' and starts_at <= ${now} and ends_at > ${now}
  order by starts_at desc limit 1
)`;

export interface CouponCardRow {
  id: string;
  weekdays: number[];
  title: string;
  headline: string;
  headline_sub: string | null;
  description: string | null;
  schedule_note: string | null;
  starts_at: Date;
  ends_at: Date | null;
  redeem_window_hours: number;
  tone: Tone;
  icon: string;
  image_url: string | null;
  savings_cents: number | null;
  total_quantity: number;
  remaining: number;
  store_id: string;
  store_slug: string;
  store_name: string;
  store_icon: string;
  store_brand_color: string;
  store_kind: Kind;
}

/**
 * select … from cupons com loja e estoque derivado (ativos no prazo + usados).
 * Quem usa acrescenta where/order/limit (aliases c, s, sc, st).
 */
export const couponCardSelect = (now: Date, extraColumns: SqlFragment = sql.empty) => sql`
  select c.id, c.title, c.headline, c.headline_sub, c.description, c.schedule_note,
         c.starts_at, c.ends_at, c.redeem_window_hours, c.tone, c.icon, c.image_url,
         c.savings_cents, c.total_quantity, c.weekdays,
         greatest(c.total_quantity - st.taken, 0) as remaining,
         s.id as store_id, s.slug as store_slug, s.name as store_name, s.icon as store_icon,
         s.brand_color as store_brand_color, sc.kind as store_kind
         ${extraColumns}
  from promotions.coupons c
  join directory.stores s on s.id = c.store_id
  join directory.store_categories sc on sc.id = s.category_id
  cross join lateral (
    select count(*) filter (where cc.status = 'active' and cc.expires_at > ${now})
         + count(*) filter (where cc.status = 'redeemed') as taken
    from promotions.coupon_claims cc
    where cc.coupon_id = c.id
  ) st
`;

export function toCouponCard(r: CouponCardRow): App.CouponCard {
  return {
    id: r.id,
    store: {
      id: r.store_id,
      slug: r.store_slug,
      name: r.store_name,
      icon: r.store_icon,
      brandColor: r.store_brand_color,
      kind: r.store_kind,
    },
    title: r.title,
    headline: r.headline,
    headlineSub: r.headline_sub,
    description: r.description,
    scheduleNote: r.schedule_note,
    startsAt: iso(r.starts_at),
    endsAt: isoOrNull(r.ends_at),
    redeemWindowHours: r.redeem_window_hours,
    tone: r.tone,
    icon: r.icon,
    imageUrl: r.image_url,
    savingsCents: r.savings_cents,
    weekdays: r.weekdays,
    stock: { total: r.total_quantity, remaining: r.remaining },
  };
}

export interface ClaimRow {
  id: string;
  weekdays: number[];
  code: string;
  status: ClaimStatus;
  claimed_at: Date;
  expires_at: Date;
  redeemed_at: Date | null;
  coupon_id: string;
  title: string;
  headline: string;
  headline_sub: string | null;
  schedule_note: string | null;
  tone: Tone;
  icon: string;
  image_url: string | null;
  savings_cents: number | null;
  store_id: string;
  store_slug: string;
  store_name: string;
  store_icon: string;
  store_brand_color: string;
  store_kind: Kind;
}

export const claimSelect = sql`
  select cc.id, cc.code, cc.status, cc.claimed_at, cc.expires_at, cc.redeemed_at,
         c.id as coupon_id, c.title, c.headline, c.headline_sub, c.schedule_note, c.tone, c.icon,
         c.image_url, c.savings_cents, c.weekdays,
         s.id as store_id, s.slug as store_slug, s.name as store_name, s.icon as store_icon,
         s.brand_color as store_brand_color, sc.kind as store_kind
  from promotions.coupon_claims cc
  join promotions.coupons c on c.id = cc.coupon_id
  join directory.stores s on s.id = c.store_id
  join directory.store_categories sc on sc.id = s.category_id
`;

export function toClaim(r: ClaimRow, now: Date): App.Claim {
  return {
    id: r.id,
    code: r.code,
    status: walletStatusOf(r.status, r.expires_at, now),
    claimedAt: iso(r.claimed_at),
    expiresAt: iso(r.expires_at),
    redeemedAt: isoOrNull(r.redeemed_at),
    coupon: {
      id: r.coupon_id,
      title: r.title,
      headline: r.headline,
      headlineSub: r.headline_sub,
      scheduleNote: r.schedule_note,
      tone: r.tone,
      icon: r.icon,
      imageUrl: r.image_url,
      savingsCents: r.savings_cents,
      weekdays: r.weekdays,
    },
    store: {
      id: r.store_id,
      slug: r.store_slug,
      name: r.store_name,
      icon: r.store_icon,
      brandColor: r.store_brand_color,
      kind: r.store_kind,
    },
  };
}

export interface ChallengeRow {
  id: string;
  title: string;
  how_to: string;
  icon: string;
  validation: "qr" | "auto";
  seal_id: string;
  seal_name: string;
  seal_icon: string;
  seal_gradient_from: string;
  seal_gradient_to: string;
  store_id: string | null;
  store_slug: string | null;
  store_name: string | null;
  event_id: string | null;
  event_title: string | null;
  earned_at: Date | null;
}

/** Desafios com selo, loja, evento e se o visitante já ganhou (aliases ch, se, cst, cev, es). */
export const challengeSelect = (visitorId: string | null) => sql`
  select ch.id, ch.title, ch.how_to, ch.icon, ch.validation,
         se.id as seal_id, se.name as seal_name, se.icon as seal_icon,
         se.gradient_from as seal_gradient_from, se.gradient_to as seal_gradient_to,
         cst.id as store_id, cst.slug as store_slug, cst.name as store_name,
         cev.id as event_id, cev.title as event_title,
         es.earned_at
  from gamification.challenges ch
  join gamification.seals se on se.id = ch.seal_id
  left join directory.stores cst on cst.id = ch.store_id
  left join agenda.events cev on cev.id = ch.event_id
  left join gamification.earned_seals es
    on es.challenge_id = ch.id and es.visitor_id = ${visitorId}::uuid
`;

export function toChallengeItem(r: ChallengeRow): App.ChallengeItem {
  return {
    id: r.id,
    title: r.title,
    howTo: r.how_to,
    icon: r.icon,
    validation: r.validation,
    seal: {
      id: r.seal_id,
      name: r.seal_name,
      icon: r.seal_icon,
      gradientFrom: r.seal_gradient_from,
      gradientTo: r.seal_gradient_to,
    },
    store: r.store_id
      ? { id: r.store_id, slug: r.store_slug ?? "", name: r.store_name ?? "" }
      : null,
    event: r.event_id ? { id: r.event_id, title: r.event_title ?? "" } : null,
    earned: r.earned_at !== null,
    earnedAt: isoOrNull(r.earned_at),
  };
}

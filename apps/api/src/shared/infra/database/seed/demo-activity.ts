import type { StoreKind } from "@arp/contracts";
import { toLocal } from "../../../domain/time";
import { DAY_MS, type DemoClock, HOUR_MS } from "./demo-time";
import type { Random } from "./random";

/*
 * Atividade fictícia de visitantes de demonstração (puro: sem banco). Gera
 * linhas prontas para inserir, respeitando as mesmas invariantes que a API:
 * - nunca mais pegos contando no estoque (ativos no prazo + usados) que o total;
 * - um cupom ativo por visitante/promoção;
 * - um selo por visitante/desafio, dentro do período da campanha;
 * - troca de prêmio só com pontos para isso;
 * - nada no futuro, nada antes do cadastro do visitante.
 * Horários seguem um padrão realista: picos no almoço e à noite, mais
 * movimento de sexta a domingo.
 */

export const DEMO_EMAIL_DOMAIN = "demo.example.com";

/* Entradas --------------------------------------------------------------- */

export interface CouponInput {
  id: string;
  storeId: string;
  kind: StoreKind;
  startsAt: Date;
  endsAt: Date | null;
  totalQuantity: number;
  redeemWindowHours: number;
  /** Rascunho e cupom em revisão não recebem pegos. */
  live: boolean;
  /** Procura simulada (tentativas de pegar ao longo do período). */
  demand: number;
}

export interface ChallengeInput {
  id: string;
  sealId: string;
  sealPoints: number;
  sealValidityMonths: number;
  repeatable: boolean;
  validation: "qr" | "auto";
  qrCodeIds: string[];
  popularity: number;
}

export interface CampaignInput {
  id: string;
  /** 0 = mês corrente, -1 = anterior… */
  monthOffset: number;
  startsAt: Date;
  endsAt: Date;
  challenges: ChallengeInput[];
}

export interface PrizeInput {
  id: string;
  points: number;
  popularity: number;
}

export interface ActivityInput {
  clock: DemoClock;
  rng: Random;
  visitorCount: number;
  /** Hash de um segredo aleatório descartado: ninguém entra como visitante fictício. */
  passwordHash: string;
  firstNames: readonly string[];
  lastNames: readonly string[];
  storeIds: string[];
  coupons: CouponInput[];
  campaigns: CampaignInput[];
  prizes: PrizeInput[];
  /** Quem valida no caixa e entrega prêmio (usuário do painel). */
  staffUserId: string | null;
}

/* Saídas (colunas do banco) ---------------------------------------------- */

export interface VisitorRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  password_hash: string | null;
  auth_provider: "password" | "google" | "apple";
  provider_subject: string | null;
  marketing_opt_in: boolean;
  terms_accepted_at: Date;
  status: "active" | "blocked";
  blocked_reason: string | null;
  last_seen_at: Date;
  /** Apelido no ranking do Clube (parte dos fictícios participa). */
  ranking_nickname: string | null;
  ranking_accepted_at: Date | null;
  is_demo: true;
  created_at: Date;
  updated_at: Date;
}

export interface ClaimRow {
  id: string;
  coupon_id: string;
  visitor_id: string;
  code: string;
  status: "active" | "redeemed" | "expired" | "cancelled";
  claimed_at: Date;
  expires_at: Date;
  redeemed_at: Date | null;
  redeemed_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface EarnedSealRow {
  id: string;
  visitor_id: string;
  challenge_id: string;
  seal_id: string;
  campaign_id: string;
  qr_code_id: string | null;
  earned_at: Date;
  points: number;
  expires_at: Date;
  repeatable: boolean;
}

export interface ScanRow {
  id: string;
  qr_code_id: string | null;
  visitor_id: string;
  result: "awarded" | "duplicate" | "expired" | "invalid";
  scanned_at: Date;
}

export interface LinkRow {
  visitor_id: string;
  store_id: string;
  created_at: Date;
}

export interface RedemptionRow {
  id: string;
  prize_id: string;
  visitor_id: string;
  points: number;
  code: string;
  status: "pending" | "delivered" | "cancelled";
  created_at: Date;
  delivered_at: Date | null;
  delivered_by: string | null;
}

export interface Activity {
  visitors: VisitorRow[];
  claims: ClaimRow[];
  earnedSeals: EarnedSealRow[];
  scans: ScanRow[];
  favorites: LinkRow[];
  follows: LinkRow[];
  redemptions: RedemptionRow[];
}

/* Padrão de horário ------------------------------------------------------ */

type Profile = "food" | "shop" | "general" | "signup";

// Peso por hora local (0–23), entre 0 e 1.
const HOUR_WEIGHTS: Record<Profile, readonly number[]> = {
  food: [
    0.03, 0.01, 0, 0, 0, 0, 0, 0.02, 0.08, 0.15, 0.25, 0.55, 0.95, 0.9, 0.5, 0.3, 0.35, 0.5, 0.8, 1,
    0.95, 0.75, 0.45, 0.15,
  ],
  shop: [
    0, 0, 0, 0, 0, 0, 0, 0.02, 0.05, 0.15, 0.35, 0.5, 0.6, 0.6, 0.65, 0.75, 0.85, 0.95, 1, 0.95,
    0.75, 0.5, 0.2, 0.05,
  ],
  general: [
    0.02, 0.01, 0, 0, 0, 0, 0.02, 0.08, 0.2, 0.3, 0.45, 0.6, 0.85, 0.8, 0.55, 0.5, 0.55, 0.7, 0.9,
    1, 0.95, 0.75, 0.45, 0.15,
  ],
  signup: [
    0.1, 0.05, 0.02, 0.01, 0.01, 0.02, 0.05, 0.15, 0.25, 0.3, 0.4, 0.5, 0.65, 0.6, 0.45, 0.45, 0.5,
    0.6, 0.8, 0.95, 1, 0.9, 0.6, 0.3,
  ],
};
// Peso por dia da semana (0 = domingo): fim de semana cheio, segunda vazia.
const WEEKDAY_WEIGHTS = [0.95, 0.4, 0.5, 0.55, 0.65, 0.9, 1] as const;

function sampleTime(rng: Random, from: Date, to: Date, profile: Profile, recency = 0): Date {
  const a = from.getTime();
  const b = to.getTime();
  if (b <= a) return new Date(a);
  for (let i = 0; i < 400; i++) {
    const t = a + rng.next() * (b - a);
    const p = toLocal(new Date(t));
    let w = (HOUR_WEIGHTS[profile][p.hour] ?? 0) * (WEEKDAY_WEIGHTS[p.weekday] ?? 1);
    // recency > 0: mais registros perto do fim do intervalo (base crescendo).
    if (recency > 0) w *= 1 - recency + recency * ((t - a) / (b - a));
    if (rng.next() < w) return new Date(t);
  }
  return new Date(a + rng.next() * (b - a));
}

const minDate = (...dates: Date[]) => new Date(Math.min(...dates.map((d) => d.getTime())));
const maxDate = (...dates: Date[]) => new Date(Math.max(...dates.map((d) => d.getTime())));
const plus = (d: Date, ms: number) => new Date(d.getTime() + ms);
const addMonths = (d: Date, months: number) => {
  const out = new Date(d);
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
};

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TOKEN_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/* Geração ---------------------------------------------------------------- */

interface VisitorState {
  row: VisitorRow;
  /** 1 = pouco ativo … 4 = muito ativo. */
  engagement: number;
  lastActivity: Date;
}

export function generateActivity(input: ActivityInput): Activity {
  const { clock, rng } = input;
  const now = clock.now;
  const usedCodes = new Set<string>();
  const newCode = (prefix: string): string => {
    for (;;) {
      const code = `${prefix}${rng.string(CODE_ALPHABET, 6)}`;
      if (!usedCodes.has(code)) {
        usedCodes.add(code);
        return code;
      }
    }
  };
  const touch = (v: VisitorState, at: Date) => {
    if (at > v.lastActivity) v.lastActivity = at;
  };

  /* Visitantes */

  const visitors: VisitorState[] = [];
  const usedEmails = new Set<string>();
  const usedNicknames = new Set<string>();
  const oldCount = Math.round(input.visitorCount * 0.22);
  const blockedIndexes = new Set([7, 31]);
  for (let i = 0; i < input.visitorCount; i++) {
    const first = rng.pick(input.firstNames);
    const last = rng.pick(input.lastNames);
    const middle = rng.chance(0.35) ? ` ${rng.pick(input.lastNames)}` : "";
    const name = `${first}${middle} ${last}`;
    const base = `${slugify(first)}.${slugify(last)}`;
    let email = `${base}@${DEMO_EMAIL_DOMAIN}`;
    for (let n = 2; usedEmails.has(email); n++) email = `${base}${n}@${DEMO_EMAIL_DOMAIN}`;
    usedEmails.add(email);

    // Parte da base é antiga (antes da janela de 90 dias) para os KPIs terem
    // "período anterior"; o resto cresce até hoje. O último cadastro é de
    // menos de 2 h: é por ele que se sabe quando os dados foram gerados.
    const created =
      i === input.visitorCount - 1
        ? plus(now, -rng.int(20, 110) * 60_000)
        : i < oldCount
          ? sampleTime(rng, clock.at(-180), clock.at(-91), "signup")
          : sampleTime(rng, clock.at(-90), plus(now, -2 * HOUR_MS), "signup", 0.6);
    const provider = rng.weighted([
      ["password", 0.68],
      ["google", 0.22],
      ["apple", 0.1],
    ] as const);
    const blocked = blockedIndexes.has(i);
    let nickname: string | null = null;
    if (!blocked && rng.chance(0.45)) {
      const nick = `${slugify(first)}${slugify(last).slice(0, 1).toUpperCase()}`;
      nickname = `${nick[0]?.toUpperCase()}${nick.slice(1)}${rng.int(10, 99)}`;
      while (usedNicknames.has(nickname.toLowerCase())) nickname = `${nickname}${rng.int(0, 9)}`;
      usedNicknames.add(nickname.toLowerCase());
    }
    visitors.push({
      row: {
        id: rng.uuidV7At(created),
        name,
        email,
        phone: rng.chance(0.8) ? `(22) 9${rng.int(8000, 9999)}-${rng.int(1000, 9999)}` : null,
        password_hash: provider === "password" ? input.passwordHash : null,
        auth_provider: provider,
        provider_subject: provider === "password" ? null : `demo-${rng.string(TOKEN_ALPHABET, 21)}`,
        marketing_opt_in: rng.chance(0.62),
        terms_accepted_at: created,
        status: blocked ? "blocked" : "active",
        blocked_reason: blocked
          ? i === 7
            ? "Várias contas para pegar o mesmo cupom."
            : "Compartilhou QR Codes de desafio em grupo público."
          : null,
        last_seen_at: created,
        ranking_nickname: nickname,
        ranking_accepted_at: nickname ? created : null,
        is_demo: true,
        created_at: created,
        updated_at: created,
      },
      engagement: rng.weighted([
        [1, 0.35],
        [2, 0.35],
        [3, 0.2],
        [4, 0.1],
      ] as const),
      lastActivity: created,
    });
  }
  const pickVisitor = (at: Date, exclude: (v: VisitorState) => boolean): VisitorState | null => {
    const pool = visitors.filter(
      (v) => v.row.created_at < at && v.row.status === "active" && !exclude(v),
    );
    if (pool.length === 0) return null;
    return rng.weighted(pool.map((v) => [v, v.engagement] as const));
  };

  /* Cupons pegos: simulação cronológica com estoque */

  const claims: ClaimRow[] = [];
  const countsAt = (c: ClaimRow, t: Date): boolean => {
    if (c.claimed_at > t) return false;
    if (c.status === "redeemed") return true;
    if (c.status === "cancelled") return t < c.updated_at;
    return t < c.expires_at; // active ou expired
  };
  const activeFor = (c: ClaimRow, t: Date): boolean => {
    if (c.claimed_at > t) return false;
    if (c.status === "redeemed") return t < (c.redeemed_at as Date);
    if (c.status === "cancelled") return t < c.updated_at;
    return t < c.expires_at;
  };

  const makeClaim = (
    coupon: CouponInput,
    visitor: VisitorState,
    claimedAt: Date,
    outcome: "redeemed" | "expired" | "cancelled",
  ): ClaimRow => {
    const windowMs = coupon.redeemWindowHours * HOUR_MS;
    const expiresAt = plus(claimedAt, windowMs);
    let status: ClaimRow["status"] = outcome;
    let redeemedAt: Date | null = null;
    let updatedAt = claimedAt;
    if (outcome === "redeemed") {
      // Maioria usa logo (mesma visita); parte volta outro dia, dentro do prazo.
      const delay = rng.chance(0.7)
        ? (0.1 + rng.next() * 2.5) * HOUR_MS
        : rng.next() * windowMs * 0.85;
      redeemedAt = plus(claimedAt, Math.max(5 * 60_000, delay));
      if (redeemedAt >= now) {
        status = "active";
        redeemedAt = null;
      } else {
        updatedAt = redeemedAt;
      }
    } else if (outcome === "expired") {
      if (expiresAt > now) status = "active";
      else updatedAt = expiresAt;
    } else {
      const cancelAt = plus(claimedAt, (0.2 + rng.next() * 2) * HOUR_MS);
      if (cancelAt >= now) status = "active";
      else updatedAt = cancelAt;
    }
    touch(visitor, redeemedAt ?? claimedAt);
    return {
      id: rng.uuidV7At(claimedAt),
      coupon_id: coupon.id,
      visitor_id: visitor.row.id,
      code: newCode("ARP-"),
      status,
      claimed_at: claimedAt,
      expires_at: expiresAt,
      redeemed_at: redeemedAt,
      redeemed_by: redeemedAt ? input.staffUserId : null,
      created_at: claimedAt,
      updated_at: updatedAt,
    };
  };

  for (const coupon of input.coupons) {
    if (!coupon.live) continue;
    const from = coupon.startsAt;
    const to = minDate(coupon.endsAt ?? now, plus(now, -60_000));
    if (to <= from) continue;
    const profile: Profile = coupon.kind === "food" ? "food" : "shop";
    const couponClaims: ClaimRow[] = [];
    const candidates = Array.from({ length: coupon.demand }, () =>
      sampleTime(rng, from, to, profile),
    ).sort((x, y) => x.getTime() - y.getTime());

    for (const at of candidates) {
      const counted = couponClaims.filter((c) => countsAt(c, at)).length;
      if (counted >= coupon.totalQuantity) continue; // esgotado naquele momento
      const visitor = pickVisitor(at, (v) =>
        couponClaims.some((c) => c.visitor_id === v.row.id && activeFor(c, at)),
      );
      if (!visitor) continue;
      const outcome = rng.weighted([
        ["redeemed", 0.62],
        ["expired", 0.3],
        ["cancelled", 0.08],
      ] as const);
      couponClaims.push(makeClaim(coupon, visitor, at, outcome));
    }
    claims.push(...couponClaims);
  }

  /* Selos e leituras de QR */

  const earnedSeals: EarnedSealRow[] = [];
  const scans: ScanRow[] = [];
  const campaigns = [...input.campaigns].sort((a, b) => b.monthOffset - a.monthOffset);

  for (const campaign of campaigns) {
    const windowEnd = minDate(campaign.endsAt, plus(now, -5 * 60_000));
    if (windowEnd <= campaign.startsAt) continue;
    const previous = campaigns.find((c) => c.monthOffset === campaign.monthOffset - 1);

    for (const visitor of visitors) {
      const from = maxDate(campaign.startsAt, visitor.row.created_at);
      if (from >= windowEnd || visitor.row.status !== "active") continue;
      if (!rng.chance(0.3 + 0.15 * visitor.engagement)) continue;
      const chosen = campaign.challenges.filter((c) =>
        rng.chance(Math.min(0.95, c.popularity * (0.7 + 0.25 * visitor.engagement))),
      );

      for (const challenge of chosen) {
        const earnedAt = sampleTime(rng, from, windowEnd, "general");
        const qrCodeId = challenge.validation === "qr" ? rng.pick(challenge.qrCodeIds) : null;
        earnedSeals.push({
          id: rng.uuidV7At(earnedAt),
          visitor_id: visitor.row.id,
          challenge_id: challenge.id,
          seal_id: challenge.sealId,
          campaign_id: campaign.id,
          qr_code_id: qrCodeId,
          earned_at: earnedAt,
          points: challenge.sealPoints,
          expires_at: addMonths(earnedAt, challenge.sealValidityMonths),
          repeatable: challenge.repeatable,
        });
        touch(visitor, earnedAt);
        if (!qrCodeId) continue;
        scans.push({
          id: rng.uuidV7At(earnedAt),
          qr_code_id: qrCodeId,
          visitor_id: visitor.row.id,
          result: "awarded",
          scanned_at: earnedAt,
        });
        // Leu de novo o mesmo QR (o app responde "você já ganhou este selo").
        if (rng.chance(0.14)) {
          const again = sampleTime(rng, plus(earnedAt, 10 * 60_000), windowEnd, "general");
          if (again > earnedAt) {
            scans.push({
              id: rng.uuidV7At(again),
              qr_code_id: qrCodeId,
              visitor_id: visitor.row.id,
              result: "duplicate",
              scanned_at: again,
            });
          }
        }
      }

      // Leu um QR da campanha do mês passado (já encerrada): "expirou".
      if (previous && rng.chance(0.2)) {
        const oldQr = previous.challenges.flatMap((c) => c.qrCodeIds);
        if (oldQr.length > 0) {
          const at = sampleTime(rng, from, windowEnd, "general");
          scans.push({
            id: rng.uuidV7At(at),
            qr_code_id: rng.pick(oldQr),
            visitor_id: visitor.row.id,
            result: "expired",
            scanned_at: at,
          });
          touch(visitor, at);
        }
      }
    }
  }

  // Tokens que não existem (QR de outro app, foto de tela adulterada…).
  for (let i = 0; i < 16; i++) {
    const at = sampleTime(rng, clock.at(-90), plus(now, -10 * 60_000), "general");
    const visitor = pickVisitor(at, () => false);
    if (!visitor) continue;
    scans.push({
      id: rng.uuidV7At(at),
      qr_code_id: null,
      visitor_id: visitor.row.id,
      result: "invalid",
      scanned_at: at,
    });
  }

  /* Trocas na lojinha: só quem juntou pontos para isso */

  const redemptions: RedemptionRow[] = [];
  const sealsByVisitor = new Map<string, EarnedSealRow[]>();
  for (const s of earnedSeals) {
    sealsByVisitor.set(s.visitor_id, [...(sealsByVisitor.get(s.visitor_id) ?? []), s]);
  }
  const prizes = [...input.prizes].sort((a, b) => a.points - b.points);
  for (const visitor of visitors) {
    const own = (sealsByVisitor.get(visitor.row.id) ?? []).sort(
      (a, b) => a.earned_at.getTime() - b.earned_at.getTime(),
    );
    if (own.length === 0 || !rng.chance(0.55)) continue;
    let spent = 0;
    for (const prize of rng.sample(prizes, rng.int(1, 2))) {
      if (!rng.chance(prize.popularity)) continue;
      // Primeiro instante em que os selos valendo pagam a troca.
      let reachedAt: Date | null = null;
      for (const s of own) {
        const valid = own
          .filter((x) => x.earned_at <= s.earned_at && x.expires_at > s.earned_at)
          .reduce((sum, x) => sum + x.points, 0);
        if (valid - spent >= prize.points) {
          reachedAt = s.earned_at;
          break;
        }
      }
      if (!reachedAt || reachedAt >= plus(now, -HOUR_MS)) continue;
      const at = sampleTime(rng, plus(reachedAt, 30 * 60_000), plus(now, -30 * 60_000), "general");
      if (at <= reachedAt) continue;
      const recent = at > plus(now, -3 * DAY_MS);
      const status = rng.weighted(
        recent
          ? ([
              ["pending", 0.7],
              ["delivered", 0.3],
            ] as const)
          : ([
              ["delivered", 0.85],
              ["cancelled", 0.1],
              ["pending", 0.05],
            ] as const),
      );
      const deliveredAt =
        status === "delivered"
          ? minDate(plus(at, rng.int(20, 60 * 48) * 60_000), plus(now, -5 * 60_000))
          : null;
      if (status !== "cancelled") spent += prize.points;
      redemptions.push({
        id: rng.uuidV7At(at),
        prize_id: prize.id,
        visitor_id: visitor.row.id,
        points: prize.points,
        code: newCode(""),
        status,
        created_at: at,
        delivered_at: deliveredAt,
        delivered_by: deliveredAt ? input.staffUserId : null,
      });
      touch(visitor, at);
    }
  }

  /* Lojas favoritas e seguidas */

  const favorites: LinkRow[] = [];
  const follows: LinkRow[] = [];
  for (const visitor of visitors) {
    const link = (storeId: string, rows: LinkRow[]) => {
      const at = sampleTime(rng, visitor.row.created_at, plus(now, -30 * 60_000), "general");
      rows.push({ visitor_id: visitor.row.id, store_id: storeId, created_at: at });
      touch(visitor, at);
    };
    const favCount = rng.weighted([
      [0, 0.25],
      [1, 0.3],
      [2, 0.25],
      [3, 0.12],
      [4, 0.08],
    ] as const);
    for (const storeId of rng.sample(input.storeIds, favCount)) link(storeId, favorites);
    const followCount = rng.weighted([
      [0, 0.45],
      [1, 0.3],
      [2, 0.17],
      [3, 0.08],
    ] as const);
    for (const storeId of rng.sample(input.storeIds, followCount)) link(storeId, follows);
  }

  for (const visitor of visitors) {
    // Última atividade = último uso do app (bloqueados param de usar).
    const lastSeen = minDate(plus(visitor.lastActivity, rng.int(1, 40) * 60_000), now);
    visitor.row.last_seen_at = lastSeen;
    visitor.row.updated_at = visitor.row.status === "blocked" ? lastSeen : visitor.row.created_at;
  }

  const activity: Activity = {
    visitors: visitors.map((v) => v.row),
    claims,
    earnedSeals,
    scans,
    favorites,
    follows,
    redemptions,
  };
  assertActivityInvariants(activity, input.coupons, now);
  return activity;
}

/**
 * Confere as invariantes antes de gravar: se a simulação tiver um erro, o
 * seed falha aqui com mensagem clara em vez de deixar dados inconsistentes.
 */
export function assertActivityInvariants(
  activity: Activity,
  coupons: CouponInput[],
  now: Date,
): void {
  const byCoupon = new Map<string, ClaimRow[]>();
  for (const c of activity.claims) {
    if (c.claimed_at > now) throw new Error(`Demo: cupom pego no futuro (${c.code})`);
    byCoupon.set(c.coupon_id, [...(byCoupon.get(c.coupon_id) ?? []), c]);
  }
  for (const coupon of coupons) {
    const list = byCoupon.get(coupon.id) ?? [];
    // O pico de "contando no estoque" só muda quando um pego entra.
    for (const probe of list) {
      const t = probe.claimed_at;
      const counted = list.filter((c) => {
        if (c.claimed_at > t) return false;
        if (c.status === "redeemed") return true;
        if (c.status === "cancelled") return t < c.updated_at;
        return t < c.expires_at;
      }).length;
      if (counted > coupon.totalQuantity) {
        throw new Error(`Demo: estoque estourado no cupom ${coupon.id} em ${t.toISOString()}`);
      }
    }
    // Um visitante nunca segura dois cupons da mesma promoção ao mesmo tempo.
    const until = (c: ClaimRow) =>
      c.status === "redeemed"
        ? (c.redeemed_at as Date)
        : c.status === "cancelled"
          ? c.updated_at
          : c.expires_at;
    const byVisitor = new Map<string, ClaimRow[]>();
    for (const c of list) byVisitor.set(c.visitor_id, [...(byVisitor.get(c.visitor_id) ?? []), c]);
    for (const own of byVisitor.values()) {
      own.sort((x, y) => x.claimed_at.getTime() - y.claimed_at.getTime());
      for (let i = 1; i < own.length; i++) {
        const prev = own[i - 1] as ClaimRow;
        if ((own[i] as ClaimRow).claimed_at < until(prev) || prev.status === "active") {
          throw new Error(`Demo: pegos sobrepostos do mesmo visitante no cupom ${coupon.id}`);
        }
      }
    }
  }
  const sealKeys = new Set<string>();
  for (const s of activity.earnedSeals) {
    const key = `${s.visitor_id}:${s.challenge_id}`;
    if (sealKeys.has(key)) throw new Error("Demo: selo repetido no mesmo desafio");
    sealKeys.add(key);
  }
}

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

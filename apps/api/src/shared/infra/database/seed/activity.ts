import type { StoreKind } from "@arp/contracts";
import { DEMO_VISITOR, FIRST_NAMES, LAST_NAMES } from "./catalog";
import type { Random } from "./random";
import { DAY_MS, HOUR_MS, localParts, type SeedClock } from "./time";

/*
 * Atividade sintética dos visitantes (puro: sem banco). Gera linhas prontas
 * para inserir, respeitando as mesmas invariantes que a API garante:
 * - nunca mais pegos contando no estoque (ativos no prazo + usados) que o total;
 * - um claim ativo por visitante/cupom;
 * - um selo por visitante/desafio, dentro do período da campanha;
 * - nada no futuro, nada antes do cadastro do visitante.
 * Horários seguem um padrão realista: picos no almoço e à noite, mais
 * movimento de sexta a domingo.
 */

/* Entradas --------------------------------------------------------------- */

export interface CouponInput {
  id: string;
  storeId: string;
  kind: StoreKind;
  startsAt: Date;
  endsAt: Date | null;
  totalQuantity: number;
  redeemWindowHours: number;
  status: string;
  takenNow: number | null;
  demand: number;
}

export interface ChallengeInput {
  id: string;
  ref: string;
  sealId: string;
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

export interface ActivityInput {
  clock: SeedClock;
  rng: Random;
  visitorCount: number;
  passwordHash: string;
  avatarUrl: string | null;
  stores: { id: string; slug: string }[];
  coupons: CouponInput[];
  /** Coupon id por ref do catálogo (c2, c3, c6… para a Ana). */
  couponIdByRef: Map<string, string>;
  campaigns: CampaignInput[];
  /** Eventos publicados que podem receber "Tenho interesse". */
  interestEventIds: string[];
  jazzEventId: string | null;
  /** Quem valida no caixa (lojista da loja, senão o atendimento). */
  redeemerFor(storeId: string): string | null;
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
  avatar_url: string | null;
  marketing_opt_in: boolean;
  terms_accepted_at: Date;
  status: "active" | "blocked";
  blocked_reason: string | null;
  last_seen_at: Date;
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

export interface InterestRow {
  visitor_id: string;
  event_id: string;
  created_at: Date;
}

export interface PushTokenRow {
  id: string;
  visitor_id: string;
  token: string;
  platform: "ios" | "android";
  created_at: Date;
  last_seen_at: Date;
}

export interface Activity {
  visitors: VisitorRow[];
  claims: ClaimRow[];
  earnedSeals: EarnedSealRow[];
  scans: ScanRow[];
  favorites: LinkRow[];
  follows: LinkRow[];
  interests: InterestRow[];
  pushTokens: PushTokenRow[];
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
    const p = localParts(new Date(t));
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
  const newCode = (): string => {
    for (;;) {
      const code = `ARP-${rng.string(CODE_ALPHABET, 6)}`;
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
  const anaCreated = clock.at(-150, "19:12");
  const ana: VisitorState = {
    row: {
      id: rng.uuidV7At(anaCreated),
      name: DEMO_VISITOR.name,
      email: DEMO_VISITOR.email,
      phone: DEMO_VISITOR.phone,
      password_hash: input.passwordHash,
      auth_provider: "password",
      provider_subject: null,
      avatar_url: input.avatarUrl,
      marketing_opt_in: true,
      terms_accepted_at: anaCreated,
      status: "active",
      blocked_reason: null,
      last_seen_at: anaCreated,
      created_at: anaCreated,
      updated_at: anaCreated,
    },
    engagement: 4,
    lastActivity: anaCreated,
  };
  visitors.push(ana);

  const usedEmails = new Set<string>([DEMO_VISITOR.email]);
  const oldCount = Math.round(input.visitorCount * 0.22);
  const blockedIndexes = new Set([7, 31]);
  for (let i = 0; i < input.visitorCount; i++) {
    const first = rng.pick(FIRST_NAMES);
    const last = rng.pick(LAST_NAMES);
    const middle = rng.chance(0.35) ? ` ${rng.pick(LAST_NAMES)}` : "";
    const name = `${first}${middle} ${last}`;
    const base = `${slugify(first)}.${slugify(last)}`;
    let email = `${base}@example.com`;
    for (let n = 2; usedEmails.has(email); n++) email = `${base}${n}@example.com`;
    usedEmails.add(email);

    // Parte da base é antiga (antes da janela de 90 dias) para os KPIs
    // terem "período anterior"; o resto cresce até hoje.
    const created =
      i < oldCount
        ? sampleTime(rng, clock.at(-180), clock.at(-91), "signup")
        : sampleTime(rng, clock.at(-90), plus(now, -2 * HOUR_MS), "signup", 0.6);
    const provider = rng.weighted([
      ["password", 0.68],
      ["google", 0.22],
      ["apple", 0.1],
    ] as const);
    const blocked = blockedIndexes.has(i);
    visitors.push({
      row: {
        id: rng.uuidV7At(created),
        name,
        email,
        phone: rng.chance(0.8) ? `(24) 9${rng.int(8000, 9999)}-${rng.int(1000, 9999)}` : null,
        password_hash: provider === "password" ? input.passwordHash : null,
        auth_provider: provider,
        provider_subject: provider === "password" ? null : rng.string(TOKEN_ALPHABET, 21),
        avatar_url: null,
        marketing_opt_in: rng.chance(0.62),
        terms_accepted_at: created,
        status: blocked ? "blocked" : "active",
        blocked_reason: blocked
          ? i === 7
            ? "Várias contas para pegar o mesmo cupom."
            : "Compartilhou QR Codes de desafio em grupo público."
          : null,
        last_seen_at: created,
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
  const synthetic = visitors.slice(1);
  const pickVisitor = (at: Date, exclude: (v: VisitorState) => boolean): VisitorState | null => {
    const pool = synthetic.filter((v) => v.row.created_at < at && !exclude(v));
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

  const liveUntil = (c: ClaimRow): Date => {
    if (c.status === "redeemed") return c.redeemed_at as Date;
    if (c.status === "cancelled") return c.updated_at;
    return c.expires_at;
  };
  const overlaps = (c: ClaimRow, start: Date, end: Date): boolean =>
    c.claimed_at <= end && liveUntil(c) > start;

  const makeClaim = (
    coupon: CouponInput,
    visitor: VisitorState,
    claimedAt: Date,
    outcome: "redeemed" | "expired" | "cancelled" | "active",
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
    } else if (outcome === "cancelled") {
      const cancelAt = plus(claimedAt, (0.2 + rng.next() * 2) * HOUR_MS);
      if (cancelAt >= now) status = "active";
      else updatedAt = cancelAt;
    }
    const row: ClaimRow = {
      id: rng.uuidV7At(claimedAt),
      coupon_id: coupon.id,
      visitor_id: visitor.row.id,
      code: newCode(),
      status,
      claimed_at: claimedAt,
      expires_at: expiresAt,
      redeemed_at: redeemedAt,
      redeemed_by: redeemedAt ? input.redeemerFor(coupon.storeId) : null,
      created_at: claimedAt,
      updated_at: updatedAt,
    };
    touch(visitor, redeemedAt ?? claimedAt);
    return row;
  };

  // Os cupons da Ana, como no protótipo (um ativo, um usado, um expirado).
  const anaPresets: {
    ref: string;
    code: string;
    hoursAgo: number;
    outcome: ClaimRow["status"];
    usedAfterHours?: number;
  }[] = [
    { ref: "c2", code: "ARP-F7Q2AC", hoursAgo: 5, outcome: "active" },
    { ref: "c3", code: "ARP-9KD2AC", hoursAgo: 74, outcome: "redeemed", usedAfterHours: 1 },
    { ref: "c6", code: "ARP-T2LMAC", hoursAgo: 50, outcome: "expired" },
  ];

  for (const coupon of input.coupons) {
    if (coupon.status === "draft") continue;
    const from = coupon.startsAt;
    const to = minDate(coupon.endsAt ?? now, plus(now, -60_000));
    if (to <= from) continue;
    const profile: Profile = coupon.kind === "food" ? "food" : "shop"; // serviços: mesmo padrão de lojas
    const couponClaims: ClaimRow[] = [];

    // Presets da Ana entram na mesma linha do tempo (e contam no estoque).
    const presets = anaPresets
      .filter((p) => input.couponIdByRef.get(p.ref) === coupon.id)
      .map((p) => {
        const claimedAt = plus(now, -p.hoursAgo * HOUR_MS);
        usedCodes.add(p.code);
        const expiresAt = plus(claimedAt, coupon.redeemWindowHours * HOUR_MS);
        const redeemedAt =
          p.outcome === "redeemed" ? plus(claimedAt, (p.usedAfterHours ?? 1) * HOUR_MS) : null;
        touch(ana, redeemedAt ?? claimedAt);
        return {
          id: rng.uuidV7At(claimedAt),
          coupon_id: coupon.id,
          visitor_id: ana.row.id,
          code: p.code,
          status: p.outcome,
          claimed_at: claimedAt,
          expires_at: expiresAt,
          redeemed_at: redeemedAt,
          redeemed_by: redeemedAt ? input.redeemerFor(coupon.storeId) : null,
          created_at: claimedAt,
          updated_at: redeemedAt ?? (p.outcome === "expired" ? expiresAt : claimedAt),
        } satisfies ClaimRow;
      });

    const candidates = Array.from({ length: coupon.demand }, () =>
      sampleTime(rng, from, to, profile),
    ).sort((x, y) => x.getTime() - y.getTime());

    const events = [
      ...presets.map((p) => ({ at: p.claimed_at, preset: p as ClaimRow | null })),
      ...candidates.map((at) => ({ at, preset: null as ClaimRow | null })),
    ].sort((x, y) => x.at.getTime() - y.at.getTime());

    for (const { at, preset } of events) {
      const counted = couponClaims.filter((c) => countsAt(c, at)).length;
      if (preset) {
        if (counted >= coupon.totalQuantity) {
          throw new Error(`Seed: cupom da Ana estouraria o estoque (${coupon.id})`);
        }
        couponClaims.push(preset);
        continue;
      }
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

    // Ajuste fino para bater o "quantos já foram pegos" do protótipo.
    if (coupon.takenNow !== null && (!coupon.endsAt || coupon.endsAt > now)) {
      const target = Math.min(coupon.takenNow, coupon.totalQuantity);
      const windowStart = maxDate(from, plus(now, -coupon.redeemWindowHours * HOUR_MS * 0.9));
      for (let attempt = 0; attempt < 200; attempt++) {
        if (couponClaims.filter((c) => countsAt(c, now)).length >= target) break;
        const at = sampleTime(rng, windowStart, plus(now, -2 * 60_000), profile);
        // O novo claim conta de `at` até agora: o pico nesse trecho precisa caber.
        const probes = [at, ...couponClaims.map((c) => c.claimed_at).filter((t) => t > at)];
        const peak = Math.max(
          ...probes.map((t) => couponClaims.filter((c) => countsAt(c, t)).length),
        );
        if (peak >= coupon.totalQuantity) continue;
        // E o visitante não pode ter outro claim vivo em nenhum ponto desse trecho.
        const visitor = pickVisitor(at, (v) =>
          couponClaims.some((c) => c.visitor_id === v.row.id && overlaps(c, at, now)),
        );
        if (!visitor) continue;
        couponClaims.push(makeClaim(coupon, visitor, at, rng.chance(0.3) ? "redeemed" : "active"));
      }
    }

    claims.push(...couponClaims);
  }

  /* Selos e leituras de QR */

  const earnedSeals: EarnedSealRow[] = [];
  const scans: ScanRow[] = [];
  const campaigns = [...input.campaigns].sort((a, b) => b.monthOffset - a.monthOffset);
  const anaSeals: Record<number, string[]> = {
    0: ["tour", "descarte"],
    [-1]: ["tour", "prato", "estac"],
    [-2]: ["tour"],
  };

  for (const campaign of campaigns) {
    const windowEnd = minDate(campaign.endsAt, plus(now, -5 * 60_000));
    if (windowEnd <= campaign.startsAt) continue;
    const previous = campaigns.find((c) => c.monthOffset === campaign.monthOffset - 1);

    for (const visitor of visitors) {
      const from = maxDate(campaign.startsAt, visitor.row.created_at);
      if (from >= windowEnd) continue;
      const isAna = visitor === ana;
      let chosen: ChallengeInput[];
      if (isAna) {
        const refs = anaSeals[campaign.monthOffset] ?? [];
        chosen = campaign.challenges.filter((c) => refs.includes(c.ref));
      } else {
        if (!rng.chance(0.3 + 0.15 * visitor.engagement)) continue;
        chosen = campaign.challenges.filter((c) =>
          rng.chance(Math.min(0.95, c.popularity * (0.7 + 0.25 * visitor.engagement))),
        );
      }

      for (const challenge of chosen) {
        const earnedAt = isAna
          ? sampleTime(rng, maxDate(from, plus(windowEnd, -6 * DAY_MS)), windowEnd, "general")
          : sampleTime(rng, from, windowEnd, "general");
        const qrCodeId = challenge.validation === "qr" ? rng.pick(challenge.qrCodeIds) : null;
        earnedSeals.push({
          id: rng.uuidV7At(earnedAt),
          visitor_id: visitor.row.id,
          challenge_id: challenge.id,
          seal_id: challenge.sealId,
          campaign_id: campaign.id,
          qr_code_id: qrCodeId,
          earned_at: earnedAt,
          // Padrão do selo: 10 pontos, vence em 6 meses.
          points: 10,
          expires_at: plus(earnedAt, 182 * DAY_MS),
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
        if (!isAna && rng.chance(0.14)) {
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
      if (!isAna && previous && rng.chance(0.2)) {
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

  /* Favoritos, lojas seguidas, interesse em eventos, tokens de push */

  const favorites: LinkRow[] = [];
  const follows: LinkRow[] = [];
  const interests: InterestRow[] = [];
  const pushTokens: PushTokenRow[] = [];
  const storeBySlug = new Map(input.stores.map((s) => [s.slug, s.id]));
  const storeIds = input.stores.map((s) => s.id);

  for (const visitor of visitors) {
    const isAna = visitor === ana;
    const since = visitor.row.created_at;
    const link = (storeId: string, rows: LinkRow[]) => {
      const at = sampleTime(rng, since, plus(now, -30 * 60_000), "general");
      rows.push({ visitor_id: visitor.row.id, store_id: storeId, created_at: at });
      touch(visitor, at);
    };

    const favs = isAna
      ? ["a-feitoria", "cafe-da-serra"].map((s) => storeBySlug.get(s)).filter(isString)
      : rng.sample(
          storeIds,
          rng.weighted([
            [0, 0.25],
            [1, 0.3],
            [2, 0.25],
            [3, 0.12],
            [4, 0.08],
          ] as const),
        );
    for (const storeId of favs) link(storeId, favorites);

    const fol = isAna
      ? ["casa-brava"].map((s) => storeBySlug.get(s)).filter(isString)
      : rng.sample(
          storeIds,
          rng.weighted([
            [0, 0.45],
            [1, 0.3],
            [2, 0.17],
            [3, 0.08],
          ] as const),
        );
    for (const storeId of fol) link(storeId, follows);

    const evts = isAna
      ? [input.jazzEventId].filter(isString)
      : rng.sample(
          input.interestEventIds,
          rng.weighted([
            [0, 0.4],
            [1, 0.35],
            [2, 0.18],
            [3, 0.07],
          ] as const),
        );
    for (const eventId of evts) {
      const at = sampleTime(
        rng,
        maxDate(since, plus(now, -21 * DAY_MS)),
        plus(now, -15 * 60_000),
        "general",
      );
      interests.push({ visitor_id: visitor.row.id, event_id: eventId, created_at: at });
      touch(visitor, at);
    }
  }

  for (const visitor of visitors) {
    // Última atividade = último uso do app (bloqueados param de usar).
    const lastSeen = minDate(plus(visitor.lastActivity, rng.int(1, 40) * 60_000), now);
    visitor.row.last_seen_at = lastSeen;
    visitor.row.updated_at = visitor.row.status === "blocked" ? lastSeen : visitor.row.created_at;

    if (visitor === ana || rng.chance(0.72)) {
      pushTokens.push({
        id: rng.uuidV7At(visitor.row.created_at),
        visitor_id: visitor.row.id,
        token: `ExponentPushToken[${rng.string(TOKEN_ALPHABET, 22)}]`,
        platform: rng.chance(0.45) ? "ios" : "android",
        created_at: visitor.row.created_at,
        last_seen_at: lastSeen,
      });
    }
  }

  const activity: Activity = {
    visitors: visitors.map((v) => v.row),
    claims,
    earnedSeals,
    scans,
    favorites,
    follows,
    interests,
    pushTokens,
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
    if (c.claimed_at > now) throw new Error(`Seed: claim no futuro (${c.code})`);
    byCoupon.set(c.coupon_id, [...(byCoupon.get(c.coupon_id) ?? []), c]);
  }
  for (const coupon of coupons) {
    const list = byCoupon.get(coupon.id) ?? [];
    // O pico de "contando no estoque" só muda quando um claim entra.
    for (const probe of list) {
      const t = probe.claimed_at;
      const counted = list.filter((c) => {
        if (c.claimed_at > t) return false;
        if (c.status === "redeemed") return true;
        if (c.status === "cancelled") return t < c.updated_at;
        return t < c.expires_at;
      }).length;
      if (counted > coupon.totalQuantity) {
        throw new Error(`Seed: estoque estourado no cupom ${coupon.id} em ${t.toISOString()}`);
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
          throw new Error(`Seed: claims sobrepostos do mesmo visitante no cupom ${coupon.id}`);
        }
      }
    }
  }
  const sealKeys = new Set<string>();
  for (const s of activity.earnedSeals) {
    const key = `${s.visitor_id}:${s.challenge_id}`;
    if (sealKeys.has(key)) throw new Error("Seed: selo repetido no mesmo desafio");
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

function isString(v: string | null | undefined): v is string {
  return typeof v === "string";
}

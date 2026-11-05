import { randomBytes } from "node:crypto";
import type { StoreKind } from "@arp/contracts";
import type { Database, DatabaseLogger } from "../database";
import { type SqlFragment, sql } from "../sql";
import { ADMIN_USER } from "./catalog";
import {
  type CampaignInput,
  type CouponInput,
  generateActivity,
  type PrizeInput,
} from "./demo-activity";
import { insertDemoEvents } from "./demo-events";
import { createDemoClock, DAY_MS, type DemoClock, HOUR_MS, zoned } from "./demo-time";
import { Random } from "./random";

/*
 * Dados fictícios de demonstração: enquanto o app tem pouco uso, enchem o
 * painel e o app (dashboard, visitantes, cupons, eventos, desafios, clube,
 * notificações) com atividade plausível em lojas e selos reais. Tudo nasce com
 * is_demo: o painel mostra um ícone nessas linhas; o app mostra cupons, eventos,
 * campanha e prêmios fictícios só com DEMO_DATA_IN_APP (padrão: sim). Visitante
 * fictício não entra (senha aleatória descartada), não aparece no ranking e
 * não recebe push.
 *
 * Os dados são relativos ao "agora": com mais de STALE_MS, tudo é apagado e
 * gerado de novo (seed na subida e o job refresh-demo-data), para o "últimos
 * 7 dias" nunca ficar vazio. SEED_DEMO_DATA=false apaga tudo.
 */

const DEMO_LOCK_KEY = 7_310_528_606;
const RNG_SEED = 20_261_105;
const VISITOR_COUNT = 380;
/** Gerados há mais que isso: refaz. */
export const STALE_MS = 20 * HOUR_MS;

export type DemoSyncResult = "created" | "kept" | "removed" | "none";

export interface DemoSyncDeps {
  db: Database;
  hashPassword: (plain: string) => Promise<string>;
  logger?: DatabaseLogger;
}

/** Cria, renova ou apaga os dados fictícios conforme `enabled`. Idempotente e seguro entre réplicas. */
export async function syncDemoData(
  deps: DemoSyncDeps,
  enabled: boolean,
  now: Date = new Date(),
): Promise<DemoSyncResult> {
  const { db, logger } = deps;
  // Hash fora da transação (argon2 é lento); o segredo é descartado.
  const passwordHash = enabled
    ? await deps.hashPassword(randomBytes(32).toString("base64url"))
    : "";
  const result = await db.transaction(async (): Promise<DemoSyncResult> => {
    await db.query(sql`select pg_advisory_xact_lock(${DEMO_LOCK_KEY}::bigint)`);
    const state = await db.one<{
      generated_at: Date | null;
      any_demo: boolean;
      has_events: boolean;
    }>(sql`
      select (select max(created_at) from visitors.visitors where is_demo) as generated_at,
             exists (select 1 from agenda.events where is_demo) as has_events,
             exists (select 1 from visitors.visitors where is_demo)
               or exists (select 1 from agenda.events where is_demo)
               or exists (select 1 from promotions.coupons where is_demo)
               or exists (select 1 from gamification.campaigns where is_demo)
               or exists (select 1 from gamification.prizes where is_demo)
               or exists (select 1 from marketing.push_notifications where is_demo) as any_demo
    `);
    if (!enabled) {
      if (!state.any_demo) return "none";
      await purgeDemoData(db);
      return "removed";
    }
    // Sem eventos fictícios = gerados por uma versão anterior: refaz já.
    const fresh = state.generated_at && now.getTime() - state.generated_at.getTime() < STALE_MS;
    if (fresh && state.has_events) {
      return "kept";
    }
    if (state.any_demo) await purgeDemoData(db);
    return (await generateDemoData(db, passwordHash, now, logger)) ? "created" : "none";
  });
  if (result === "removed") logger?.info({}, "Dados fictícios de demonstração removidos");
  return result;
}

/** Apaga tudo o que é fictício (e o que pende disso), na ordem das chaves estrangeiras. */
export async function purgeDemoData(db: Database): Promise<void> {
  const visitors = sql`(select id from visitors.visitors where is_demo)`;
  const coupons = sql`(select id from promotions.coupons where is_demo)`;
  const campaigns = sql`(select id from gamification.campaigns where is_demo)`;
  const prizes = sql`(select id from gamification.prizes where is_demo)`;
  // Desafio de baixa de cupom fictício sai junto (com os selos que deu).
  const challenges = sql`(select id from gamification.challenges
    where campaign_id in ${campaigns} or coupon_id in ${coupons})`;
  const steps: SqlFragment[] = [
    sql`delete from gamification.prize_redemptions where visitor_id in ${visitors} or prize_id in ${prizes}`,
    sql`delete from gamification.qr_scans where visitor_id in ${visitors}
        or qr_code_id in (select id from gamification.qr_codes where challenge_id in ${challenges})`,
    sql`delete from gamification.earned_seals where visitor_id in ${visitors}
        or campaign_id in ${campaigns} or challenge_id in ${challenges}`,
    sql`delete from promotions.coupon_claims where visitor_id in ${visitors} or coupon_id in ${coupons}`,
    sql`delete from gamification.challenges where id in ${challenges}`,
    sql`delete from gamification.campaigns where id in ${campaigns}`,
    sql`delete from marketing.push_notifications where is_demo`,
    sql`delete from promotions.coupons where is_demo`,
    sql`delete from gamification.prizes where is_demo`,
    // Desafio real ligado a evento fictício perde só a ligação.
    sql`update gamification.challenges set event_id = null
        where event_id in (select id from agenda.events where is_demo)`,
    // Interesses saem em cascata; a importação do site fica com event_id nulo.
    sql`delete from agenda.events where is_demo`,
    // Favoritos, seguidas, tokens, interesses e resets saem em cascata.
    sql`delete from visitors.visitors where is_demo`,
  ];
  for (const step of steps) await db.query(step);
}

/* Catálogo fictício ------------------------------------------------------ */

interface CouponTemplate {
  title: string;
  headline: string;
  headlineSub: string;
  description: string;
  scheduleNote: string;
  icon: string;
  tone: "green" | "sand";
  savingsCents: number;
  weekdays?: number[];
}

const TEMPLATES: Record<StoreKind, CouponTemplate[]> = {
  food: [
    {
      title: "Sobremesa grátis no almoço",
      headline: "Grátis",
      headlineSub: "a sobremesa",
      description: "Na compra de um prato principal, a sobremesa do dia é por conta da casa.",
      scheduleNote: "Seg a sex, 11h às 15h",
      icon: "cake-slice",
      tone: "sand",
      savingsCents: 1800,
      weekdays: [1, 2, 3, 4, 5],
    },
    {
      title: "Segundo café pela metade do preço",
      headline: "50%",
      headlineSub: "no 2º café",
      description: "Pediu um café especial? O segundo sai pela metade do preço.",
      scheduleNote: "Todos os dias",
      icon: "coffee",
      tone: "sand",
      savingsCents: 700,
    },
    {
      title: "Chopp em dobro no happy hour",
      headline: "2x1",
      headlineSub: "no chopp",
      description: "Pediu um chopp, ganhou outro. Um cupom por pessoa.",
      scheduleNote: "Qui a sáb, 17h às 20h",
      icon: "beer",
      tone: "green",
      savingsCents: 1400,
      weekdays: [4, 5, 6],
    },
    {
      title: "10% OFF na conta",
      headline: "10%",
      headlineSub: "OFF",
      description: "Desconto na conta toda, para até quatro pessoas.",
      scheduleNote: "Todos os dias",
      icon: "utensils",
      tone: "green",
      savingsCents: 1500,
    },
    {
      title: "Pizza brotinho de cortesia",
      headline: "Grátis",
      headlineSub: "a brotinho",
      description: "Na compra de uma pizza grande, a brotinho doce é cortesia.",
      scheduleNote: "Fins de semana",
      icon: "pizza",
      tone: "sand",
      savingsCents: 2500,
      weekdays: [0, 6],
    },
  ],
  shop: [
    {
      title: "15% OFF em toda a loja",
      headline: "15%",
      headlineSub: "OFF",
      description: "Desconto em todas as peças, inclusive a coleção nova. Não cumulativo.",
      scheduleNote: "Enquanto durar",
      icon: "shopping-bag",
      tone: "green",
      savingsCents: 4500,
    },
    {
      title: "R$ 20 OFF acima de R$ 150",
      headline: "R$ 20",
      headlineSub: "OFF",
      description: "Nas compras a partir de R$ 150, R$ 20 de desconto no caixa.",
      scheduleNote: "Todos os dias",
      icon: "tag",
      tone: "sand",
      savingsCents: 2000,
    },
    {
      title: "Brinde na compra acima de R$ 100",
      headline: "Brinde",
      headlineSub: "na compra",
      description: "Comprou R$ 100 ou mais, leva um brinde da loja.",
      scheduleNote: "Enquanto durar",
      icon: "gift",
      tone: "green",
      savingsCents: 1500,
    },
  ],
  service: [
    {
      title: "Avaliação grátis",
      headline: "Grátis",
      headlineSub: "a avaliação",
      description: "Primeira avaliação sem custo, com hora marcada.",
      scheduleNote: "Seg a sáb",
      icon: "sparkles",
      tone: "green",
      savingsCents: 5000,
      weekdays: [1, 2, 3, 4, 5, 6],
    },
    {
      title: "20% OFF no primeiro serviço",
      headline: "20%",
      headlineSub: "OFF",
      description: "Desconto no primeiro atendimento para quem chega pelo app.",
      scheduleNote: "Todos os dias",
      icon: "badge-percent",
      tone: "sand",
      savingsCents: 3000,
    },
  ],
};

type CouponState = "live" | "ended" | "paused" | "pending" | "rejected" | "draft";

/**
 * Quais cupons e como estão. Dias de início e fim relativos a hoje; usado
 * conta no estoque para sempre, então a quantidade é o total da promoção
 * (com a procura perto dela, a promoção esgota perto do fim, como na vida real).
 */
const COUPON_PLAN = (
  [
    // tipo, situação, início, fim, quantidade, prazo para usar (h), procura
    ["food", "live", -75, null, 420, 12, 420],
    ["food", "live", -120, null, 700, 24, 650],
    ["food", "live", -45, 20, 300, 6, 320],
    ["shop", "live", -30, 10, 200, 48, 190],
    ["shop", "live", -60, null, 400, 72, 330],
    ["service", "live", -90, null, 160, 72, 150],
    ["food", "ended", -150, -95, 350, 24, 380],
    ["shop", "ended", -100, -35, 260, 48, 280],
    ["service", "paused", -50, null, 120, 48, 110],
    ["food", "pending", 2, 30, 100, 24, 0],
    ["shop", "pending", 1, 21, 80, 48, 0],
    ["service", "rejected", 3, 33, 60, 24, 0],
    ["food", "draft", 7, 37, 100, 24, 0],
  ] as const
).map(([kind, state, starts, ends, quantity, windowHours, demand]) => ({
  kind: kind as StoreKind,
  state: state as CouponState,
  starts: starts as number,
  ends: ends as number | null,
  quantity: quantity as number,
  windowHours: windowHours as number,
  demand: demand as number,
}));

const CHALLENGES: {
  seal: string;
  title: string;
  howTo: string;
  icon: string;
  validation: "qr" | "auto";
  product: string | null;
  qrLabels: string[];
  popularity: number;
}[] = [
  {
    seal: "explorador",
    title: "Visite o Túnel do Tempo",
    howTo: "QR Code na saída do Túnel do Tempo",
    icon: "compass",
    validation: "qr",
    product: null,
    qrLabels: ["Totem do Túnel do Tempo"],
    popularity: 0.55,
  },
  {
    seal: "mao-verde",
    title: "Descarte recicláveis no Sustentarp",
    howTo: "QR Code no ponto do Sustentarp",
    icon: "recycle",
    validation: "qr",
    product: null,
    qrLabels: ["Ponto do Sustentarp"],
    popularity: 0.35,
  },
  {
    seal: "bom-garfo",
    title: "Prove o prato do mês de um parceiro",
    howTo: "O QR Code vem junto com a conta",
    icon: "utensils",
    validation: "qr",
    product: "Prato do mês",
    qrLabels: ["Conta do restaurante parceiro"],
    popularity: 0.3,
  },
  {
    seal: "agito",
    title: "Participe de um evento",
    howTo: "QR Code na entrada do evento",
    icon: "party-popper",
    validation: "qr",
    product: null,
    qrLabels: ["Entrada · Praça central", "Entrada · Terraço"],
    popularity: 0.4,
  },
  {
    seal: "cultural",
    title: "Faça o Circuito Cultural",
    howTo: "QR Code no último ponto do Circuito",
    icon: "palette",
    validation: "qr",
    product: null,
    qrLabels: ["Totem do Circuito Cultural"],
    popularity: 0.45,
  },
  {
    seal: "sem-fila",
    title: "Pague o estacionamento pelo app",
    howTo: "Validação automática ao pagar",
    icon: "car",
    validation: "auto",
    product: null,
    qrLabels: [],
    popularity: 0.25,
  },
];

const TIERS = [
  { threshold: 3, label: "10% OFF no estacionamento", icon: "car" },
  { threshold: 6, label: "Brinde + sorteio do mês", icon: "gift" },
] as const;

const PRIZES: {
  name: string;
  description: string;
  kind: "souvenir" | "artist" | "partner";
  points: number;
  stock: number;
  active: boolean;
  popularity: number;
}[] = [
  {
    name: "Café especial em parceiro",
    description: "Um café especial em uma das cafeterias parceiras.",
    kind: "partner",
    points: 20,
    stock: 60,
    active: true,
    popularity: 0.7,
  },
  {
    name: "Garrafa térmica ARP",
    description: "Garrafa térmica de inox com a marca da ARP.",
    kind: "souvenir",
    points: 40,
    stock: 25,
    active: true,
    popularity: 0.5,
  },
  {
    name: "Camiseta Circuito Cultural",
    description: "Camiseta de algodão com a arte do Circuito Cultural.",
    kind: "souvenir",
    points: 60,
    stock: 15,
    active: true,
    popularity: 0.4,
  },
  {
    name: "Gravura de artista local",
    description: "Gravura assinada por artista de Nova Friburgo.",
    kind: "artist",
    points: 80,
    stock: 8,
    active: true,
    popularity: 0.3,
  },
  {
    name: "Ecobag de algodão",
    description: "Ecobag cru com estampa da ARP (esgotada).",
    kind: "souvenir",
    points: 30,
    stock: 0,
    active: false,
    popularity: 0.5,
  },
];

const FIRST_NAMES = [
  "Ana",
  "Beatriz",
  "Bruna",
  "Camila",
  "Carolina",
  "Clara",
  "Daniela",
  "Eduarda",
  "Fernanda",
  "Gabriela",
  "Helena",
  "Isabela",
  "Júlia",
  "Larissa",
  "Letícia",
  "Luana",
  "Manuela",
  "Mariana",
  "Natália",
  "Patrícia",
  "Renata",
  "Sofia",
  "Tainá",
  "Valentina",
  "Yasmin",
  "André",
  "Arthur",
  "Bernardo",
  "Bruno",
  "Caio",
  "Carlos",
  "Daniel",
  "Davi",
  "Diego",
  "Eduardo",
  "Felipe",
  "Gabriel",
  "Gustavo",
  "Heitor",
  "Igor",
  "João",
  "José",
  "Leonardo",
  "Lucas",
  "Marcelo",
  "Mateus",
  "Miguel",
  "Otávio",
  "Paulo",
  "Pedro",
  "Rafael",
  "Ricardo",
  "Rodrigo",
  "Thiago",
  "Vinícius",
  "Wesley",
] as const;

const LAST_NAMES = [
  "Almeida",
  "Alves",
  "Andrade",
  "Araújo",
  "Barbosa",
  "Barros",
  "Cardoso",
  "Carvalho",
  "Castro",
  "Costa",
  "Cunha",
  "Dias",
  "Duarte",
  "Fernandes",
  "Ferreira",
  "Freitas",
  "Gomes",
  "Lima",
  "Lopes",
  "Macedo",
  "Machado",
  "Martins",
  "Medeiros",
  "Melo",
  "Mendes",
  "Monteiro",
  "Moreira",
  "Nascimento",
  "Nogueira",
  "Oliveira",
  "Pereira",
  "Pinto",
  "Ramos",
  "Ribeiro",
  "Rocha",
  "Rodrigues",
  "Santos",
  "Siqueira",
  "Silva",
  "Soares",
  "Teixeira",
  "Vieira",
] as const;

/* Geração ---------------------------------------------------------------- */

type Row = Record<string, unknown>;

async function generateDemoData(
  db: Database,
  passwordHash: string,
  now: Date,
  logger?: DatabaseLogger,
): Promise<boolean> {
  const clock = createDemoClock(now);
  const rng = new Random(RNG_SEED);

  const stores = await db.many<{ id: string; kind: StoreKind }>(sql`
    select s.id, sc.kind from directory.stores s
    join directory.store_categories sc on sc.id = s.category_id
    where s.status = 'active'
    order by s.slug
  `);
  if (stores.length < 3) {
    logger?.info({}, "Sem lojas para os dados fictícios; nada gerado");
    return false;
  }
  const staff = await db.maybeOne<{ id: string }>(sql`
    select u.id from identity.users u
    order by (lower(u.email) = lower(${ADMIN_USER.email})) desc, u.created_at
    limit 1
  `);
  const staffUserId = staff?.id ?? null;

  const coupons = await insertCoupons(db, rng, clock, stores, staffUserId);
  const campaigns = await insertCampaigns(db, rng, clock, staffUserId);
  const prizes = await insertPrizes(db, clock);

  const activity = generateActivity({
    clock,
    rng,
    visitorCount: VISITOR_COUNT,
    passwordHash,
    firstNames: FIRST_NAMES,
    lastNames: LAST_NAMES,
    storeIds: stores.map((s) => s.id),
    coupons,
    campaigns,
    prizes,
    staffUserId,
  });
  await insertMany(db, "visitors.visitors", activity.visitors);
  await insertMany(db, "visitors.favorite_stores", activity.favorites);
  await insertMany(db, "visitors.store_follows", activity.follows);
  await insertMany(db, "promotions.coupon_claims", activity.claims);
  await insertMany(db, "gamification.earned_seals", activity.earnedSeals);
  await insertMany(db, "gamification.qr_scans", activity.scans);
  await insertMany(db, "gamification.prize_redemptions", activity.redemptions);
  if (staffUserId) await insertNotifications(db, clock, coupons, staffUserId);
  const events = await insertDemoEvents(db, rng, clock, activity.visitors);

  logger?.info(
    {
      visitantes: activity.visitors.length,
      cuponsPegos: activity.claims.length,
      selos: activity.earnedSeals.length,
      leiturasQr: activity.scans.length,
      trocas: activity.redemptions.length,
      eventos: events,
    },
    "Dados fictícios de demonstração gerados",
  );
  return true;
}

async function insertCoupons(
  db: Database,
  rng: Random,
  clock: DemoClock,
  stores: { id: string; kind: StoreKind }[],
  staffUserId: string | null,
): Promise<CouponInput[]> {
  const byKind = new Map<StoreKind, string[]>();
  for (const s of stores) byKind.set(s.kind, [...(byKind.get(s.kind) ?? []), s.id]);
  const used = new Set<string>();
  const nextTemplate = new Map<StoreKind, number>();
  const inputs: CouponInput[] = [];

  for (const plan of COUPON_PLAN) {
    // Loja do tipo pedido (sem repetir); sem nenhuma, qualquer loja.
    const pool = (byKind.get(plan.kind) ?? []).filter((id) => !used.has(id));
    const fallback = stores.map((s) => s.id).filter((id) => !used.has(id));
    const storeId = rng.pick(
      pool.length > 0 ? pool : fallback.length > 0 ? fallback : [stores[0]?.id as string],
    );
    used.add(storeId);
    const kind = stores.find((s) => s.id === storeId)?.kind ?? plan.kind;
    const templates = TEMPLATES[kind];
    const n = nextTemplate.get(kind) ?? 0;
    nextTemplate.set(kind, n + 1);
    const t = templates[n % templates.length] as CouponTemplate;

    const startsAt = clock.at(plan.starts, "08:00");
    const endsAt = plan.ends === null ? null : clock.at(plan.ends, "23:00");
    const createdAt = new Date(Math.min(startsAt.getTime(), clock.now.getTime()) - 3 * DAY_MS);
    const status =
      plan.state === "ended"
        ? "ended"
        : plan.state === "paused"
          ? "paused"
          : plan.state === "draft"
            ? "draft"
            : "active";
    const review =
      plan.state === "pending" ? "pending" : plan.state === "rejected" ? "rejected" : "approved";
    const row = await db.one<{ id: string }>(sql`
      ${insertInto("promotions.coupons", [
        {
          store_id: storeId,
          title: t.title,
          headline: t.headline,
          headline_sub: t.headlineSub,
          description: t.description,
          schedule_note: t.scheduleNote,
          weekdays: t.weekdays ?? [0, 1, 2, 3, 4, 5, 6],
          starts_at: startsAt,
          ends_at: endsAt,
          total_quantity: plan.quantity,
          redeem_window_hours: plan.windowHours,
          tone: t.tone,
          icon: t.icon,
          savings_cents: t.savingsCents,
          status,
          review,
          review_note:
            review === "rejected"
              ? "Desconto acima do combinado com a ARP. Ajuste para no máximo 15%."
              : null,
          created_by: staffUserId,
          is_demo: true,
          created_at: createdAt,
          updated_at: createdAt,
        },
      ])}
      returning id
    `);
    inputs.push({
      id: row.id,
      storeId,
      kind,
      startsAt,
      endsAt,
      totalQuantity: plan.quantity,
      redeemWindowHours: plan.windowHours,
      live: review === "approved" && status !== "draft",
      demand: plan.demand,
    });
  }
  return inputs;
}

async function insertCampaigns(
  db: Database,
  rng: Random,
  clock: DemoClock,
  staffUserId: string | null,
): Promise<CampaignInput[]> {
  const seals = await db.many<{
    id: string;
    slug: string;
    points: number;
    validity_months: number;
    repeatable: boolean;
  }>(sql`
    select id, slug, points, validity_months, repeatable from gamification.seals
    where status = 'active'
  `);
  const sealBySlug = new Map(seals.map((s) => [s.slug, s]));
  const campaigns: CampaignInput[] = [];

  // Seis meses: o corrente e o anterior no ar/encerrado, os mais velhos arquivados.
  for (const offset of [0, -1, -2, -3, -4, -5]) {
    const startsAt = zoned(clock.monthStart(offset), "00:00");
    const endsAt = zoned(clock.monthEnd(offset), "23:59");
    const label = clock.monthLabel(offset);
    const created = new Date(startsAt.getTime() - 5 * DAY_MS);
    const campaign = await db.one<{ id: string }>(sql`
      ${insertInto("gamification.campaigns", [
        {
          name: `Desafios de ${label}`,
          description: `Cumpra os desafios de ${label}, junte selos e libere benefícios.`,
          starts_at: startsAt,
          ends_at: endsAt,
          status: offset >= -1 ? "published" : "archived",
          is_demo: true,
          created_at: created,
          updated_at: created,
        },
      ])}
      returning id
    `);
    await db.query(
      insertInto(
        "gamification.reward_tiers",
        TIERS.map((t) => ({
          campaign_id: campaign.id,
          threshold: t.threshold,
          label: t.label,
          icon: t.icon,
        })),
      ),
    );

    const challenges: CampaignInput["challenges"] = [];
    for (const [i, ch] of CHALLENGES.entries()) {
      const seal = sealBySlug.get(ch.seal);
      if (!seal) continue;
      const challenge = await db.one<{ id: string }>(sql`
        ${insertInto("gamification.challenges", [
          {
            campaign_id: campaign.id,
            seal_id: seal.id,
            title: ch.title,
            how_to: ch.howTo,
            icon: ch.icon,
            validation: ch.validation,
            auto_trigger: ch.validation === "auto" ? "integration" : null,
            product: ch.product,
            sort_order: i + 1,
            status: "active",
            created_at: created,
            updated_at: created,
          },
        ])}
        returning id
      `);
      const qrCodeIds: string[] = [];
      for (const label of ch.qrLabels) {
        const qr = await db.one<{ id: string }>(sql`
          ${insertInto("gamification.qr_codes", [
            {
              challenge_id: challenge.id,
              // Token de verdade (crypto): ninguém lê um QR fictício.
              token: randomBytes(18).toString("base64url"),
              label,
              status: "active",
              ttl_seconds: 604_800,
              valid_until: endsAt,
              created_by: staffUserId,
              created_at: created,
              updated_at: created,
            },
          ])}
          returning id
        `);
        qrCodeIds.push(qr.id);
      }
      challenges.push({
        id: challenge.id,
        sealId: seal.id,
        sealPoints: seal.points,
        sealValidityMonths: seal.validity_months,
        repeatable: seal.repeatable,
        validation: ch.validation,
        qrCodeIds,
        popularity: ch.popularity * (0.85 + rng.next() * 0.3),
      });
    }
    campaigns.push({ id: campaign.id, monthOffset: offset, startsAt, endsAt, challenges });
  }
  return campaigns;
}

async function insertPrizes(db: Database, clock: DemoClock): Promise<PrizeInput[]> {
  const created = clock.at(-170, "10:00");
  const inputs: PrizeInput[] = [];
  for (const [i, p] of PRIZES.entries()) {
    const row = await db.one<{ id: string }>(sql`
      ${insertInto("gamification.prizes", [
        {
          name: p.name,
          description: p.description,
          kind: p.kind,
          points: p.points,
          stock: p.stock,
          active: p.active,
          sort_order: i + 1,
          is_demo: true,
          created_at: created,
          updated_at: created,
        },
      ])}
      returning id
    `);
    inputs.push({ id: row.id, points: p.points, popularity: p.popularity });
  }
  return inputs;
}

/** Histórico de envios (nunca agendado nem rascunho: nada fictício sai para o celular de ninguém). */
async function insertNotifications(
  db: Database,
  clock: DemoClock,
  coupons: CouponInput[],
  createdBy: string,
): Promise<void> {
  const now = clock.now;
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const followed = coupons.find((c) => c.live && c.kind === "food") ?? coupons[0];
  const rows: Row[] = [
    {
      title: "Cupom novo na loja que você segue",
      body: "Tem promoção nova no app. Corre que os cupons são limitados!",
      audience: followed ? "store_followers" : "opted_in",
      store_id: followed?.storeId ?? null,
      sent_at: ago(2 * DAY_MS + 3 * HOUR_MS),
      status: "sent",
      recipients_count: 18,
      created_at: ago(2 * DAY_MS + 5 * HOUR_MS),
    },
    {
      title: `Desafios de ${clock.monthLabel()} no ar`,
      body: "Novos desafios, novos selos. Junte 3 e ganhe 10% no estacionamento.",
      audience: "opted_in",
      store_id: null,
      sent_at: ago(4 * DAY_MS),
      status: "sent",
      recipients_count: 142,
      created_at: ago(5 * DAY_MS),
    },
    {
      title: "Fim de semana com música na praça",
      body: "Sábado e domingo, a partir das 17h, música ao vivo na praça central.",
      audience: "all",
      store_id: null,
      sent_at: ago(16 * DAY_MS),
      status: "sent",
      recipients_count: 236,
      created_at: ago(17 * DAY_MS),
    },
    {
      title: "Sua sobremesa por nossa conta",
      body: "No almoço de segunda a sexta, a sobremesa do dia sai de graça com o cupom.",
      audience: "opted_in",
      store_id: null,
      sent_at: ago(38 * DAY_MS),
      status: "sent",
      recipients_count: 120,
      created_at: ago(39 * DAY_MS),
    },
    {
      title: "Feira de produtores adiada",
      body: "Por causa da chuva, a feira de produtores fica para o próximo sábado.",
      audience: "all",
      store_id: null,
      scheduled_at: ago(9 * DAY_MS),
      sent_at: null,
      status: "cancelled",
      recipients_count: 230,
      created_at: ago(11 * DAY_MS),
    },
  ];
  await insertMany(
    db,
    "marketing.push_notifications",
    rows.map((r) => ({
      scheduled_at: null,
      deep_link: null,
      ...r,
      created_by: createdBy,
      is_demo: true,
      updated_at: r.created_at,
    })),
  );
}

/* SQL -------------------------------------------------------------------- */

/** insert into <tabela> (colunas) values (...), (...) — colunas da primeira linha. */
function insertInto(table: string, rows: Row[]): SqlFragment {
  const first = rows[0];
  if (!first) throw new Error("insertInto sem linhas");
  const columns = Object.keys(first);
  const values = rows.map((row) => sql`(${sql.join(columns.map((c) => row[c]))})`);
  return sql`insert into ${sql.identifier(table)} (${sql.join(columns.map((c) => sql.identifier(c)))}) values ${sql.join(values)}`;
}

/** Em lotes abaixo do limite de 65535 parâmetros por comando. */
async function insertMany(db: Database, table: string, rows: object[]): Promise<void> {
  const first = rows[0];
  if (!first) return;
  const perBatch = Math.max(1, Math.floor(30_000 / Object.keys(first).length));
  for (let i = 0; i < rows.length; i += perBatch) {
    await db.query(insertInto(table, rows.slice(i, i + perBatch) as Row[]));
  }
}

import type { Database, DatabaseLogger } from "../database";
import { sql } from "../sql";
import { SITE_TEXTS } from "./site-data";

/*
 * Limpeza única do catálogo fictício que o seed antigo gravava (lojas, eventos,
 * cupons, desafios, visitantes sintéticos…). Só roda se a marca dele ainda
 * existir (a loja "casa-brava" ou a visitante de demonstração); depois disso
 * nunca mais. Apaga pelas chaves que o seed antigo usava, nada além.
 */

const STORE_SLUGS = [
  "a-feitoria",
  "casa-brava",
  "cafe-da-serra",
  "doce-tilia",
  "massa-fina",
  "kiro-sushi",
  "atelie-linho",
  "entrelinhas",
  "casa-mata",
  "pet-point",
  "alto-pilates",
  "barbearia-82",
  "otica-vista",
];
const USER_EMAILS = ["marketing@arp.com.br", "atendimento@arp.com.br", "casabrava@arp.com.br"];
const EVENT_TITLES = [
  "Corredor Cultural",
  "Roda de Samba",
  "Jazz no Pátio",
  "Feira de Produtores",
  "Oficina de Cerâmica",
  "Cinema ao ar livre",
  "Yoga ao amanhecer",
  "Festival de Inverno",
  "Sarau de poesia",
  "Show de rock na praça",
];
const HIGHLIGHT_TITLES = [
  "Corredor Cultural",
  "Chopp pela metade na Casa Brava",
  "Jazz no Pátio",
  "Rodízio de temaki no Kiro",
  "Bem-vindo à nova ARP",
];
const NOTIFICATION_TITLES = [
  "Chopp pela metade hoje na Casa Brava",
  "Jazz no Pátio é depois de amanhã",
  "Feira de Produtores neste sábado",
  "Show de rock na praça",
];
const PRIZE_NAMES = [
  "Ecobag ARP",
  "Caneca ARP",
  "Pôster de artista local",
  "Café especial no parceiro",
];
const MAP_POINT_LABELS = [
  "Ponto de reciclagem",
  "Início do tour",
  "Estacionamento",
  "Mirante da praça",
  "Terraço",
];

/** Categorias de loja que existem no site: as demais (do seed antigo) saem se ninguém usa. */
export async function purgeLegacyDemo(
  db: Database,
  realCategories: readonly { kind: string; name: string }[],
  logger?: DatabaseLogger,
): Promise<boolean> {
  const marker = await db.maybeOne(sql`
    select 1 where exists (select 1 from directory.stores where slug = 'casa-brava')
       or exists (select 1 from visitors.visitors where lower(email) = 'ana.clara@example.com')
  `);
  if (!marker) return false;

  const stores = sql`(select id from directory.stores where slug = any(${STORE_SLUGS}::text[]))`;
  const visitors = sql`(select id from visitors.visitors where lower(email) like '%@example.com')`;
  const coupons = sql`(select id from promotions.coupons where store_id in ${stores})`;
  const events = sql`(select id from agenda.events where title = any(${EVENT_TITLES}::text[]) or store_id in ${stores})`;
  const campaigns = sql`(select id from gamification.campaigns where name ~ '^Desafios de [[:alpha:]]+$')`;
  const challenges = sql`(select id from gamification.challenges
    where campaign_id in ${campaigns} or store_id in ${stores} or event_id in ${events} or coupon_id in ${coupons})`;
  const prizes = sql`(select id from gamification.prizes where name = any(${PRIZE_NAMES}::text[]))`;

  const steps = [
    sql`delete from gamification.earned_seals where visitor_id in ${visitors} or campaign_id in ${campaigns}
        or challenge_id in ${challenges}
        or qr_code_id in (select id from gamification.qr_codes where challenge_id in ${challenges})`,
    sql`delete from gamification.qr_scans where visitor_id in ${visitors}`,
    sql`delete from gamification.prize_redemptions where visitor_id in ${visitors} or prize_id in ${prizes}`,
    sql`delete from promotions.coupon_claims where visitor_id in ${visitors} or coupon_id in ${coupons}`,
    sql`delete from gamification.challenges where id in ${challenges}`,
    sql`delete from gamification.campaigns where id in ${campaigns}`,
    sql`delete from marketing.highlights where title = any(${HIGHLIGHT_TITLES}::text[]) or sponsor_store_id in ${stores}`,
    sql`delete from marketing.push_notifications
        where title = any(${NOTIFICATION_TITLES}::text[]) or title ~ '^Desafios de [[:alpha:]]+ no ar$' or store_id in ${stores}`,
    sql`delete from promotions.coupons where id in ${coupons}`,
    sql`delete from agenda.events where id in ${events}`,
    sql`delete from visitors.visitors where id in ${visitors}`,
    sql`update identity.users set store_id = null where store_id in ${stores}`,
    // Usuário fictício só sai se nada mais aponta para ele.
    sql`delete from identity.users u where lower(u.email) = any(${USER_EMAILS}::text[])
        and not exists (select 1 from promotions.coupons c where c.created_by = u.id)
        and not exists (select 1 from promotions.coupon_claims c where c.redeemed_by = u.id)
        and not exists (select 1 from marketing.push_notifications n where n.created_by = u.id)
        and not exists (select 1 from platform.settings s where s.updated_by = u.id)`,
    sql`delete from directory.stores where id in ${stores}`,
    sql`delete from gamification.prizes where id in ${prizes}`,
    sql`delete from directory.map_points where label = any(${MAP_POINT_LABELS}::text[])`,
    sql`delete from directory.blocks b where b.name in ('Bloco 80', 'Bloco 81', 'Bloco 82')
        and not exists (select 1 from directory.stores s where s.block_id = b.id)`,
    sql`delete from directory.store_categories c
        where (c.kind || ':' || c.name) <> all(${realCategories.map((r) => `${r.kind}:${r.name}`)}::text[])
          and not exists (select 1 from directory.stores s where s.category_id = c.id)
          and not exists (select 1 from directory.store_extra_categories e where e.category_id = c.id)`,
    sql`delete from directory.floors f where f.level <> 0 and f.layout::text like '%Bloco 8%'
        and not exists (select 1 from directory.stores s where s.floor_id = f.id)
        and not exists (select 1 from agenda.events e where e.floor_id = f.id)`,
    sql`update directory.floors set label = '1º andar', short_label = '1º', layout = '[]'::jsonb
        where level = 0 and layout::text like '%Bloco 80%'`,
    // Regras provisórias do seed antigo (mesmo salvas no painel sem mudar) dão lugar às do site.
    sql`update content.pages set body = ${SITE_TEXTS.rules}
        where key = 'rules' and body like 'Pets são bem-vindos, sempre na guia%'`,
  ];
  for (const step of steps) await db.query(step);
  logger?.info({}, "Catálogo fictício do seed antigo removido");
  return true;
}

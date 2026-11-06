import { sql } from "../../../shared/infra/database/sql";

/**
 * Horários da loja `s` como JSON ([{ weekday, opensAt, closesAt }], "HH:mm"),
 * no formato de DailyHours. Usado pela leitura do painel e pelo repositório.
 */
export const STORE_HOURS_JSON = sql`
  coalesce((
    select json_agg(json_build_object(
             'weekday', h.weekday,
             'opensAt', to_char(h.opens_at, 'HH24:MI'),
             'closesAt', to_char(h.closes_at, 'HH24:MI')) order by h.weekday, h.opens_at)
    from directory.store_hours h where h.store_id = s.id
  ), '[]'::json)
`;

/**
 * Histórico ligado à loja `s` (colunas usage_*). Qualquer um > 0 impede
 * excluir a loja: cupons, desafios, eventos, destaques, notificações,
 * vagas e lojistas (usuários ou cadastro aguardando).
 */
export const STORE_USAGE_COLUMNS = sql`
  (select count(*) from promotions.coupons x where x.store_id = s.id)::int as usage_coupons,
  (select count(*) from gamification.challenges x where x.store_id = s.id)::int as usage_challenges,
  (select count(*) from agenda.events x where x.store_id = s.id)::int as usage_events,
  (select count(*) from marketing.highlights x where x.sponsor_store_id = s.id)::int as usage_highlights,
  (select count(*) from marketing.push_notifications x where x.store_id = s.id)::int as usage_notifications,
  (select count(*) from content.jobs x where x.store_id = s.id)::int as usage_jobs,
  ((select count(*) from identity.users x where x.store_id = s.id)
    + (select count(*) from identity.merchant_signups x
       where x.store_id = s.id and x.status = 'pending'))::int as usage_merchants
`;

export interface StoreUsageRow {
  usage_coupons: number;
  usage_challenges: number;
  usage_events: number;
  usage_highlights: number;
  usage_notifications: number;
  usage_jobs: number;
  usage_merchants: number;
}

export const toStoreUsage = (r: StoreUsageRow) => ({
  coupons: r.usage_coupons,
  challenges: r.usage_challenges,
  events: r.usage_events,
  highlights: r.usage_highlights,
  notifications: r.usage_notifications,
  jobs: r.usage_jobs,
  merchants: r.usage_merchants,
});

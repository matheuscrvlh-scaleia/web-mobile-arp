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
             'closesAt', to_char(h.closes_at, 'HH24:MI')) order by h.weekday)
    from directory.store_hours h where h.store_id = s.id
  ), '[]'::json)
`;

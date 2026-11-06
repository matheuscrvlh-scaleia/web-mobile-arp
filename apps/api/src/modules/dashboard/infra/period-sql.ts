import { BUSINESS_TIME_ZONE } from "../../../shared/domain/time";
import { sql } from "../../../shared/infra/database/sql";

export const TZ = BUSINESS_TIME_ZONE;

/** Início do dia (São Paulo) como instante. */
export const startOf = (date: string) => sql`((${date}::date)::timestamp at time zone ${TZ})`;
/** Início do dia seguinte (São Paulo): fim exclusivo do intervalo. */
export const endOf = (date: string) => sql`(((${date}::date) + 1)::timestamp at time zone ${TZ})`;

/** "Eventos próximos" = publicados que acontecem de hoje até daqui a N dias. */
export const UPCOMING_EVENT_DAYS = 30;

/**
 * Visitantes contados no painel, como subconsulta (id, created_at). Sem loja:
 * todos os cadastros. Com loja (lojista ou filtro): só os clientes da loja,
 * quem já pegou um cupom dela, contando a partir do primeiro cupom (LOJ-26:
 * o lojista não vê números do shopping inteiro).
 */
export const visitorBase = (storeId: string | null) =>
  storeId
    ? sql`(select cc.visitor_id as id, min(cc.claimed_at) as created_at
           from promotions.coupon_claims cc
           join promotions.coupons c on c.id = cc.coupon_id
           where c.store_id = ${storeId}
           group by cc.visitor_id)`
    : sql`visitors.visitors`;

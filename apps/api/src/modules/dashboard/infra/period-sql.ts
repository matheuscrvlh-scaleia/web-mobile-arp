import { BUSINESS_TIME_ZONE } from "../../../shared/domain/time";
import { sql } from "../../../shared/infra/database/sql";

export const TZ = BUSINESS_TIME_ZONE;

/** Início do dia (São Paulo) como instante. */
export const startOf = (date: string) => sql`((${date}::date)::timestamp at time zone ${TZ})`;
/** Início do dia seguinte (São Paulo): fim exclusivo do intervalo. */
export const endOf = (date: string) => sql`(((${date}::date) + 1)::timestamp at time zone ${TZ})`;

/** "Eventos próximos" = publicados que acontecem de hoje até daqui a N dias. */
export const UPCOMING_EVENT_DAYS = 30;

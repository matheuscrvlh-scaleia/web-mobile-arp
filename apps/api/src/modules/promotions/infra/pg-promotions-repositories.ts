import type { Database } from "../../../shared/infra/database/database";
import { translateConstraintErrors } from "../../../shared/infra/database/errors";
import { sql } from "../../../shared/infra/database/sql";
import { Claim, type ClaimStatus, type NewClaim } from "../domain/claim";
import { Coupon, type CouponStatus, type CouponTone, type NewCoupon } from "../domain/coupon";
import { ClaimCodeCollisionError, CouponAlreadyClaimedError } from "../domain/errors";
import type {
  ClaimRepository,
  ClaimWithStore,
  CouponRepository,
  StoreLookup,
} from "../domain/repositories";

/* Cupons ----------------------------------------------------------------- */

interface CouponRow {
  id: string;
  store_id: string;
  title: string;
  headline: string;
  headline_sub: string | null;
  description: string | null;
  schedule_note: string | null;
  starts_at: Date;
  ends_at: Date | null;
  total_quantity: number;
  redeem_window_hours: number;
  tone: CouponTone;
  icon: string;
  image_url: string | null;
  savings_cents: number | null;
  status: CouponStatus;
  created_by: string | null;
}

const COUPON_COLUMNS = sql.raw(`id, store_id, title, headline, headline_sub, description,
  schedule_note, starts_at, ends_at, total_quantity, redeem_window_hours, tone, icon, image_url,
  savings_cents, status, created_by`);

const couponToDomain = (r: CouponRow) =>
  Coupon.restore({
    id: r.id,
    storeId: r.store_id,
    title: r.title,
    headline: r.headline,
    headlineSub: r.headline_sub,
    description: r.description,
    scheduleNote: r.schedule_note,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    totalQuantity: r.total_quantity,
    redeemWindowHours: r.redeem_window_hours,
    tone: r.tone,
    icon: r.icon,
    imageUrl: r.image_url,
    savingsCents: r.savings_cents,
    status: r.status,
    createdBy: r.created_by,
  });

export class PgCouponRepository implements CouponRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Coupon | null> {
    const row = await this.db.maybeOne<CouponRow>(
      sql`select ${COUPON_COLUMNS} from promotions.coupons where id = ${id}`,
    );
    return row ? couponToDomain(row) : null;
  }

  async findByIdForUpdate(id: string): Promise<Coupon | null> {
    const row = await this.db.maybeOne<CouponRow>(
      sql`select ${COUPON_COLUMNS} from promotions.coupons where id = ${id} for update`,
    );
    return row ? couponToDomain(row) : null;
  }

  async create(d: NewCoupon): Promise<Coupon> {
    const row = await this.db.one<CouponRow>(sql`
      insert into promotions.coupons
        (store_id, title, headline, headline_sub, description, schedule_note, starts_at, ends_at,
         total_quantity, redeem_window_hours, tone, icon, image_url, savings_cents, status, created_by)
      values
        (${d.storeId}, ${d.title}, ${d.headline}, ${d.headlineSub}, ${d.description},
         ${d.scheduleNote}, ${d.startsAt}, ${d.endsAt}, ${d.totalQuantity}, ${d.redeemWindowHours},
         ${d.tone}, ${d.icon}, ${d.imageUrl}, ${d.savingsCents}, ${d.status}, ${d.createdBy})
      returning ${COUPON_COLUMNS}
    `);
    return couponToDomain(row);
  }

  async save(coupon: Coupon): Promise<void> {
    const s = coupon.toState();
    await this.db.query(sql`
      update promotions.coupons
      set title = ${s.title}, headline = ${s.headline}, headline_sub = ${s.headlineSub},
          description = ${s.description}, schedule_note = ${s.scheduleNote},
          starts_at = ${s.startsAt}, ends_at = ${s.endsAt}, total_quantity = ${s.totalQuantity},
          redeem_window_hours = ${s.redeemWindowHours}, tone = ${s.tone}, icon = ${s.icon},
          image_url = ${s.imageUrl}, savings_cents = ${s.savingsCents}, status = ${s.status}
      where id = ${s.id}
    `);
  }

  async countTaken(couponId: string, now: Date): Promise<number> {
    const { taken } = await this.db.one<{ taken: number }>(sql`
      select count(*) filter (where status = 'active' and expires_at > ${now})
           + count(*) filter (where status = 'redeemed') as taken
      from promotions.coupon_claims
      where coupon_id = ${couponId}
    `);
    return taken;
  }
}

/* Cupons pegos ----------------------------------------------------------- */

interface ClaimRow {
  id: string;
  coupon_id: string;
  visitor_id: string;
  code: string;
  status: ClaimStatus;
  claimed_at: Date;
  expires_at: Date;
  redeemed_at: Date | null;
  redeemed_by: string | null;
}

const CLAIM_COLUMNS = sql.raw(
  "id, coupon_id, visitor_id, code, status, claimed_at, expires_at, redeemed_at, redeemed_by",
);

const claimToDomain = (r: ClaimRow) =>
  Claim.restore({
    id: r.id,
    couponId: r.coupon_id,
    visitorId: r.visitor_id,
    code: r.code,
    status: r.status,
    claimedAt: r.claimed_at,
    expiresAt: r.expires_at,
    redeemedAt: r.redeemed_at,
    redeemedBy: r.redeemed_by,
  });

export class PgClaimRepository implements ClaimRepository {
  constructor(private readonly db: Database) {}

  async findByCodeForUpdate(code: string): Promise<ClaimWithStore | null> {
    const row = await this.db.maybeOne<ClaimRow & { store_id: string }>(sql`
      select cl.id, cl.coupon_id, cl.visitor_id, cl.code, cl.status, cl.claimed_at, cl.expires_at,
             cl.redeemed_at, cl.redeemed_by, c.store_id
      from promotions.coupon_claims cl
      join promotions.coupons c on c.id = cl.coupon_id
      where cl.code = ${code}
      for update of cl
    `);
    return row ? { claim: claimToDomain(row), storeId: row.store_id } : null;
  }

  async claimSlot(
    couponId: string,
    visitorId: string,
    now: Date,
  ): Promise<{ taken: number; hasActive: boolean }> {
    // O update da CTE e as contagens veem o mesmo snapshot: o vencido que ela
    // expira já não contava como ocupado (ativo fora do prazo), então o número bate.
    const row = await this.db.one<{ taken: number; has_active: boolean }>(sql`
      with expired as (
        update promotions.coupon_claims set status = 'expired'
        where coupon_id = ${couponId} and visitor_id = ${visitorId}
          and status = 'active' and expires_at <= ${now}
        returning id
      )
      select
        (select count(*) from promotions.coupon_claims
          where coupon_id = ${couponId}
            and ((status = 'active' and expires_at > ${now}) or status = 'redeemed')) as taken,
        exists(select 1 from promotions.coupon_claims
               where coupon_id = ${couponId} and visitor_id = ${visitorId}
                 and status = 'active' and expires_at > ${now}) as has_active,
        (select count(*) from expired) as expired
    `);
    return { taken: row.taken, hasActive: row.has_active };
  }

  async insert(d: NewClaim): Promise<Claim> {
    // Colisão de código não aborta a transação (sem savepoint): volta vazio e quem chamou sorteia outro.
    const row = await translateConstraintErrors(
      () =>
        this.db.maybeOne<ClaimRow>(sql`
          insert into promotions.coupon_claims (coupon_id, visitor_id, code, claimed_at, expires_at)
          values (${d.couponId}, ${d.visitorId}, ${d.code}, ${d.claimedAt}, ${d.expiresAt})
          on conflict (code) do nothing
          returning ${CLAIM_COLUMNS}
        `),
      { coupon_claims_one_active_per_visitor: () => new CouponAlreadyClaimedError() },
    );
    if (!row) throw new ClaimCodeCollisionError();
    return claimToDomain(row);
  }

  async save(claim: Claim): Promise<void> {
    const s = claim.toState();
    await this.db.query(sql`
      update promotions.coupon_claims
      set status = ${s.status}, redeemed_at = ${s.redeemedAt}, redeemed_by = ${s.redeemedBy}
      where id = ${s.id}
    `);
  }

  async expireOverdueBatch(now: Date, limit: number): Promise<number> {
    // skip locked: não espera por um pego que um caixa está validando agora.
    const { rowCount } = await this.db.query(sql`
      with due as (
        select id from promotions.coupon_claims
        where status = 'active' and expires_at <= ${now}
        order by expires_at
        limit ${limit}
        for update skip locked
      )
      update promotions.coupon_claims cl set status = 'expired'
      from due where cl.id = due.id
    `);
    return rowCount;
  }
}

/* Lojas ------------------------------------------------------------------ */

export class PgStoreLookup implements StoreLookup {
  constructor(private readonly db: Database) {}

  exists(storeId: string): Promise<boolean> {
    return this.db.exists(sql`select 1 from directory.stores where id = ${storeId}`);
  }
}

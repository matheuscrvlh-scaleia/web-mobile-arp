// API pública da feature de promoções (cupons).
export { couponKeys, useCoupon, useCoupons, useCouponsByPromotion } from "./api";
export { COUPON_LIFECYCLE } from "./components/CouponBadges";
export {
  last30Days,
  type Period,
  PeriodFilter,
  previousPeriod,
} from "./components/PeriodFilter";
export { type CsvColumn, downloadCsv, toCsv } from "./lib/csv";

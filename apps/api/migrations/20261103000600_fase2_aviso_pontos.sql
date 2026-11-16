/*
 * Fase 2: aviso de pontos vencendo. Cada selo ganho avisa uma vez só
 * (push "seus pontos vencem em N dias", N em pointsExpiryNoticeDays).
 */
alter table gamification.earned_seals add column expiry_notified_at timestamptz;

create index earned_seals_expiry_notice_idx on gamification.earned_seals (expires_at)
  where expiry_notified_at is null;

comment on column gamification.earned_seals.expiry_notified_at is
  'Quando o visitante foi avisado de que este selo vai vencer (null = ainda não).';

export interface Tier {
  threshold: number;
  label: string;
  icon: string;
}

export interface CampaignProgress {
  earned: number;
  total: number;
  tiers: (Tier & { reached: boolean })[];
  nextTier: (Tier & { missing: number }) | null;
}

/** Progresso nas faixas de benefício a partir dos selos ganhos na campanha. */
export function campaignProgress(
  earned: number,
  total: number,
  tiers: readonly Tier[],
): CampaignProgress {
  const sorted = [...tiers].sort((a, b) => a.threshold - b.threshold);
  const next = sorted.find((t) => t.threshold > earned);
  return {
    earned,
    total,
    tiers: sorted.map((t) => ({ ...t, reached: earned >= t.threshold })),
    nextTier: next ? { ...next, missing: next.threshold - earned } : null,
  };
}

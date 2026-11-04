import { Trophy } from "lucide-react";
import { Link } from "react-router";
import { SealBadge } from "@/features/seals";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { Card, CardHeader } from "@/shared/ui";
import { useCouponChallenges } from "../api";
import { ChallengeInactiveBadge } from "./ChallengeBadges";

/**
 * No cupom: as campanhas e desafios em que a baixa dele no caixa dá selo.
 * Some quando o cupom não está vinculado a nenhum desafio.
 */
export function CouponChallengesCard({ couponId }: { couponId: string }) {
  const { can } = useAuth();
  const allowed = can("challenges.view");
  const challenges = useCouponChallenges(couponId, { enabled: allowed });
  const list = challenges.data ?? [];
  if (!allowed || list.length === 0) return null;

  return (
    <Card>
      <CardHeader
        icon={Trophy}
        title="Vale selo na baixa"
        description="Quando o caixa dá baixa neste cupom, o visitante ganha o selo destes desafios (com a campanha no ar). Para desvincular, mude o desafio."
      />
      <ul className="flex flex-col gap-2">
        {list.map((ch) => (
          <li key={ch.id}>
            <Link
              to={PATHS.challenge(ch.id)}
              className="flex items-center gap-3 rounded-2xl px-3 py-2 hover:bg-neutral-900/[0.04]"
            >
              <SealBadge seal={ch.seal} size={32} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium text-neutral-900">{ch.title}</span>
                <span className="truncate text-xs text-neutral-500">
                  Campanha {ch.campaign.name} · selo {ch.seal.name}
                </span>
              </span>
              {ch.status === "inactive" && <ChallengeInactiveBadge />}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

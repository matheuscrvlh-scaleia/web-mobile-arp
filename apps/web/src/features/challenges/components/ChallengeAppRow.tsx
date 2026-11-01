import type { ChallengeValidation, SealRef } from "@arp/contracts";
import { SealBadge } from "@/features/seals";
import { iconFor } from "@/shared/lib/icons";
import { VALIDATION } from "./ChallengeBadges";

/**
 * O desafio como aparece na lista "Desafios do mês" do app (.ch): ícone,
 * título, como cumprir e o selo que dá. Usado na prévia do formulário.
 */
export function ChallengeAppRow({
  icon,
  title,
  howTo,
  seal,
  validation,
}: {
  icon: string;
  title: string;
  howTo: string;
  seal: SealRef | null;
  validation: ChallengeValidation;
}) {
  const Icon = iconFor(icon);
  const VIcon = VALIDATION[validation].icon;
  return (
    <div
      aria-hidden
      className="flex items-center gap-3.5 rounded-3xl bg-[#efece8] py-3 pr-3.5 pl-3 text-[#141714]"
    >
      <span className="grid size-[3.25rem] shrink-0 place-items-center rounded-[1.1rem] bg-[#fff]">
        <Icon className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] leading-tight tracking-tight">
          {title || "Título do desafio"}
        </b>
        <span className="mt-0.5 block text-[12.5px] text-[#77716a]">
          {howTo || "Como cumprir o desafio"}
        </span>
      </span>
      <span
        className={
          validation === "qr"
            ? "inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-[#141714] px-2.5 text-xs font-semibold text-[#fff]"
            : "inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-[#fff] px-2.5 text-xs font-semibold"
        }
      >
        <VIcon className="size-3" />
        {seal?.name ?? "Selo"}
      </span>
      {seal && <SealBadge seal={seal} size={28} className="hidden sm:inline-grid" />}
    </div>
  );
}

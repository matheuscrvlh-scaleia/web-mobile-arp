import type { Campaign } from "@arp/contracts";
import {
  addMonths,
  currentMonth,
  fromZonedInput,
  MONTH_LABEL,
  monthBounds,
  todayIso,
} from "@/shared/lib/dates";
import { formatDateShort } from "@/shared/lib/format";
import type { Lifecycle } from "@/shared/ui";
import { daysLeft } from "./period";

/** Status da campanha no ciclo de vida padrão do painel. */
export function campaignLifecycle(c: Pick<Campaign, "status" | "phase">): Lifecycle {
  if (c.status === "draft") return "draft";
  if (c.status === "archived") return "archived";
  if (c.phase === "upcoming") return "scheduled";
  if (c.phase === "ended") return "ended";
  return "active";
}

/** Rótulos no feminino (a campanha). */
export const CAMPAIGN_LIFECYCLE_LABEL: Partial<Record<Lifecycle, string>> = {
  draft: "Rascunho",
  scheduled: "Agendada",
  active: "Ativa",
  ended: "Encerrada",
  archived: "Arquivada",
};

/** Dica curta ao lado do selo ("termina em 3 dias", "começa 1 dez"). */
export function campaignLifecycleHint(c: Campaign): string | undefined {
  const status = campaignLifecycle(c);
  if (status === "draft") return "fora do app";
  if (status === "scheduled") return `começa ${formatDateShort(c.startsAt)}`;
  if (status === "active") {
    const left = daysLeft(c.endsAt);
    return left <= 1 ? "termina hoje" : `termina em ${left} dias`;
  }
  return undefined;
}

/**
 * Sugestão para "Duplicar para o próximo mês": o mês seguinte ao da
 * campanha (ou o mês atual, se esse já passou), inteiro, e o nome com o mês
 * trocado ("Desafios de novembro" → "Desafios de dezembro").
 */
export function nextMonthCopy(c: Pick<Campaign, "name" | "startsAt">): {
  name: string;
  startsAt: string;
  endsAt: string;
} {
  const sourceMonth = todayIso(new Date(c.startsAt)).slice(0, 7);
  const after = addMonths(sourceMonth, 1);
  const now = currentMonth();
  const target = after < now ? now : after;
  const [first, last] = monthBounds(target);
  const fromName = MONTH_LABEL[Number(sourceMonth.slice(5)) - 1] ?? "";
  const toName = MONTH_LABEL[Number(target.slice(5)) - 1] ?? "";
  const monthRe = new RegExp(fromName, "i");
  let name = c.name;
  if (fromName && monthRe.test(name)) {
    name = name.replace(monthRe, (m) =>
      m[0] === m[0]?.toUpperCase() ? toName[0]?.toUpperCase() + toName.slice(1) : toName,
    );
    name = name.replace(sourceMonth.slice(0, 4), target.slice(0, 4));
  } else {
    name = `${name.trim()} (cópia)`;
  }
  return {
    name: name.slice(0, 80),
    startsAt: fromZonedInput(`${first}T00:00`) ?? c.startsAt,
    endsAt: fromZonedInput(`${last}T23:59`) ?? c.startsAt,
  };
}

import type { VisitorDetail } from "@arp/contracts";
import { ArrowLeft, Award, PiggyBank, Ticket, TicketCheck, UserRound } from "lucide-react";
import { Link, useParams } from "react-router";
import { PATHS } from "@/shared/config/paths";
import { useDocumentTitle } from "@/shared/hooks";
import { formatCents, formatNumber } from "@/shared/lib/format";
import { Card, LoadError, LoadingRegion, Skeleton, SkeletonGrid } from "@/shared/ui";
import { useVisitor } from "../api";
import { VisitorHero } from "../components/VisitorHero";
import {
  VisitorClaims,
  VisitorClub,
  VisitorInterests,
  VisitorSeals,
  VisitorStores,
} from "../components/VisitorSections";

export function VisitorDetailPage() {
  const { id = "" } = useParams();
  const visitor = useVisitor(id);
  useDocumentTitle(visitor.data?.name ?? "Visitante");

  if (visitor.error) {
    return (
      <LoadError
        error={visitor.error}
        onRetry={() => void visitor.refetch()}
        icon={UserRound}
        title="Visitante não encontrado"
        description="A conta pode ter sido apagada ou o endereço está errado."
        back={{ to: PATHS.visitors, label: "Ver visitantes" }}
      />
    );
  }

  if (!visitor.data) {
    return (
      <LoadingRegion>
        <Skeleton className="h-52 rounded-[2rem]" />
        <SkeletonGrid count={4} itemClassName="h-32" />
        <Skeleton className="h-72 rounded-[1.75rem]" />
      </LoadingRegion>
    );
  }

  const v = visitor.data;
  return (
    <>
      <Link
        to={PATHS.visitors}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Visitantes
      </Link>
      <div className="flex flex-col gap-5">
        <VisitorHero visitor={v} />
        <VisitorStats visitor={v} />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-5">
            <VisitorSeals visitor={v} />
            <VisitorClaims visitor={v} />
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            <VisitorClub visitor={v} />
            <VisitorStores visitor={v} />
            <VisitorInterests visitor={v} />
          </div>
        </div>
      </div>
    </>
  );
}

/** Resumo como o perfil do app: quanto economizou, selos e cupons. */
function VisitorStats({ visitor }: { visitor: VisitorDetail }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Card
        variant="green"
        className="col-span-2 flex flex-col justify-between gap-4 lg:col-span-1"
      >
        <PiggyBank className="size-6" aria-hidden />
        <div>
          <p className="text-3xl font-semibold tracking-tight tabular-nums">
            {formatCents(visitor.savingsCents)}
          </p>
          <p className="text-sm text-neutral-700">economizou com os cupons</p>
        </div>
      </Card>
      <Stat icon={Award} value={visitor.sealsCount} label="selos" />
      <Stat icon={TicketCheck} value={visitor.redeemedClaimsCount} label="cupons usados" />
      <Stat icon={Ticket} value={visitor.activeClaimsCount} label="aguardando uso" />
    </div>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof Award; value: number; label: string }) {
  return (
    <Card className="flex flex-col justify-between gap-4">
      <Icon className="size-6 text-neutral-500" aria-hidden />
      <p>
        <span className="block text-3xl font-semibold tracking-tight tabular-nums">
          {formatNumber(value)}
        </span>
        <span className="text-sm text-neutral-500">{label}</span>
      </p>
    </Card>
  );
}

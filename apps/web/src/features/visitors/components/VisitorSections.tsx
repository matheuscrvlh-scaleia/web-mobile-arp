import type { PrizeRedemptionStatus, VisitorDetail } from "@arp/contracts";
import { Award, CalendarHeart, ChevronRight, Gift, Heart, TicketPercent } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { ClaimsTable } from "@/features/claims";
import { SealBadge } from "@/features/seals";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelative,
  plural,
} from "@/shared/lib/format";
import { ButtonLink, Card, CardHeader, EmptyState, IconTile } from "@/shared/ui";

/** Selos do visitante, como a coleção do app. */
export function VisitorSeals({ visitor }: { visitor: VisitorDetail }) {
  const { can } = useAuth();
  return (
    <Card>
      <CardHeader
        title="Selos"
        icon={Award}
        description={plural(visitor.seals.length, "selo conquistado", "selos conquistados")}
        action={
          can("challenges.view") && visitor.seals.length > 0 ? (
            <ButtonLink to={PATHS.earnedSeals({ visitorId: visitor.id })} variant="ghost" size="sm">
              Ver histórico
            </ButtonLink>
          ) : undefined
        }
      />
      {visitor.seals.length === 0 ? (
        <EmptyState
          compact
          icon={Award}
          title="Nenhum selo ainda"
          description="Os selos aparecem quando a pessoa cumpre desafios no app."
        />
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-4">
          {visitor.seals.map((s) => (
            <li
              key={`${s.seal.id}-${s.earnedAt}`}
              className="flex flex-col items-center gap-2 text-center"
            >
              <SealBadge seal={s.seal} size="lg" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-neutral-900">{s.seal.name}</span>
                <span className="block text-xs text-neutral-500">{s.challengeTitle}</span>
                <span className="block text-[11px] text-neutral-400">
                  {s.campaignName} ·{" "}
                  <time dateTime={s.earnedAt} title={formatDateTime(s.earnedAt)}>
                    {formatDate(s.earnedAt)}
                  </time>
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Últimos cupons pegos (até 20) com o atalho para o histórico completo. */
export function VisitorClaims({ visitor }: { visitor: VisitorDetail }) {
  const { can } = useAuth();
  return (
    <Card>
      <CardHeader
        title="Cupons recentes"
        icon={TicketPercent}
        description="Os últimos 20 que a pessoa pegou."
        action={
          can("coupons.view") && visitor.recentClaims.length > 0 ? (
            <ButtonLink to={PATHS.claimsWith({ visitorId: visitor.id })} variant="ghost" size="sm">
              Ver todos
            </ButtonLink>
          ) : undefined
        }
      />
      <ClaimsTable
        caption={`Cupons pegos por ${visitor.name}`}
        rows={visitor.recentClaims}
        loading={false}
        hide={["visitor"]}
        empty={
          <EmptyState
            compact
            icon={TicketPercent}
            title="Nenhum cupom pego"
            description="Quando a pessoa pegar um cupom no app, ele aparece aqui."
          />
        }
      />
    </Card>
  );
}

type StoreMini = VisitorDetail["favorites"][number];

function StoreList({ stores, empty }: { stores: StoreMini[]; empty: string }) {
  const { can } = useAuth();
  if (stores.length === 0) return <p className="py-3 text-sm text-neutral-500">{empty}</p>;
  return (
    <ul className="flex flex-col divide-y divide-neutral-900/[0.06]">
      {stores.map((s) => (
        <li key={s.id}>
          <RowLink to={can("stores.view") ? PATHS.store(s.id) : null}>
            <IconTile icon={s.icon} color={s.brandColor} size="sm" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900">
              {s.name}
            </span>
          </RowLink>
        </li>
      ))}
    </ul>
  );
}

function RowLink({ to, children }: { to: string | null; children: ReactNode }) {
  const cls = "flex items-center gap-3 py-2.5";
  if (!to) return <div className={cls}>{children}</div>;
  return (
    <Link to={to} className={`${cls} group rounded-lg hover:bg-white/40`}>
      {children}
      <ChevronRight
        className="size-4 shrink-0 text-neutral-400 group-hover:text-neutral-900"
        aria-hidden
      />
    </Link>
  );
}

/** Lojas favoritas e lojas que a pessoa segue ("avisar ofertas"). */
export function VisitorStores({ visitor }: { visitor: VisitorDetail }) {
  return (
    <Card>
      <CardHeader title="Lojas" icon={Heart} />
      <h3 className="text-xs font-medium tracking-wider text-neutral-400 uppercase">
        Favoritas ({visitor.favorites.length})
      </h3>
      <StoreList stores={visitor.favorites} empty="Nenhuma loja favorita." />
      <h3 className="mt-4 text-xs font-medium tracking-wider text-neutral-400 uppercase">
        Avisa ofertas de ({visitor.follows.length})
      </h3>
      <StoreList stores={visitor.follows} empty="Não segue nenhuma loja." />
    </Card>
  );
}

/** Eventos em que a pessoa marcou "Tenho interesse". */
export function VisitorInterests({ visitor }: { visitor: VisitorDetail }) {
  const { can } = useAuth();
  return (
    <Card>
      <CardHeader title="Interesses" icon={CalendarHeart} description="Eventos marcados no app." />
      {visitor.interests.length === 0 ? (
        <p className="py-3 text-sm text-neutral-500">Nenhum evento marcado.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-900/[0.06]">
          {visitor.interests.map((i) => (
            <li key={i.event.id}>
              <RowLink to={can("events.view") ? PATHS.event(i.event.id) : null}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-neutral-900">
                    {i.event.title}
                  </span>
                  <time
                    dateTime={i.createdAt}
                    title={formatDateTime(i.createdAt)}
                    className="text-xs text-neutral-500"
                  >
                    Marcou {formatRelative(i.createdAt)}
                  </time>
                </span>
              </RowLink>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const REDEMPTION_STATUS: Record<PrizeRedemptionStatus, string> = {
  pending: "Esperando retirada",
  delivered: "Entregue",
  cancelled: "Desfeita",
};

/** Clube ARP: saldo, o que vence logo e as últimas trocas (sem precisar ir ao balcão). */
export function VisitorClub({ visitor }: { visitor: VisitorDetail }) {
  const { can } = useAuth();
  const { points, expiringPoints, nextExpiryAt, redemptions } = visitor.club;
  return (
    <Card>
      <CardHeader
        title="Clube ARP"
        icon={Gift}
        description={
          expiringPoints > 0 && nextExpiryAt
            ? `${plural(expiringPoints, "ponto vence", "pontos vencem")} a partir de ${formatDate(nextExpiryAt)}`
            : "Pontos dos selos que ainda valem, menos as trocas."
        }
      />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <p>
          <span className="text-3xl font-semibold tracking-tight tabular-nums">
            {formatNumber(points)}
          </span>{" "}
          <span className="text-sm text-neutral-500">{points === 1 ? "ponto" : "pontos"}</span>
        </p>
        {can("club.redeem") && !visitor.anonymizedAt && visitor.status === "active" ? (
          <ButtonLink
            to={`${PATHS.prizeExchange}?visitante=${encodeURIComponent(visitor.id)}`}
            variant="secondary"
            size="sm"
          >
            Trocar pontos
          </ButtonLink>
        ) : null}
      </div>
      {redemptions.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhuma troca ainda.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-900/[0.06] text-sm">
          {redemptions.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block truncate font-medium text-neutral-900">{r.prize.name}</span>
                <span className="block text-xs text-neutral-500">
                  {REDEMPTION_STATUS[r.status]} ·{" "}
                  <time dateTime={r.createdAt} title={formatDateTime(r.createdAt)}>
                    {formatDate(r.createdAt)}
                  </time>
                </span>
              </span>
              <span className="shrink-0 text-xs text-neutral-500 tabular-nums">
                −{formatNumber(r.points)} pts
              </span>
            </li>
          ))}
        </ul>
      )}
      {can("audit.view") && (
        <Link
          to={`${PATHS.audit}?actorId=${encodeURIComponent(visitor.id)}`}
          className="mt-4 inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900"
        >
          Ver o que a pessoa fez no Histórico
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      )}
    </Card>
  );
}

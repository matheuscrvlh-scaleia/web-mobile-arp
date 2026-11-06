import { type Coupon, paginationQuerySchema } from "@arp/contracts";
import {
  CalendarDays,
  Clock,
  Fingerprint,
  type LucideIcon,
  PiggyBank,
  RotateCcw,
  Store,
  Ticket,
  Timer,
  Wallet,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { CouponChallengesCard } from "@/features/challenges";
import { ClaimsTable, useClaims } from "@/features/claims";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { useDocumentTitle, useUrlState } from "@/shared/hooks";
import { formatCents, formatDateTime, formatNumber } from "@/shared/lib/format";
import {
  ButtonLink,
  Card,
  CardHeader,
  DemoMark,
  EmptyState,
  ErrorState,
  InfoItem,
  LoadingRegion,
  PageHeader,
  Pagination,
  Skeleton,
  SkeletonGrid,
} from "@/shared/ui";
import { useCoupon } from "../api";
import { CouponHeaderActions } from "../components/CouponActions";
import { CouponReviewBadge, CouponStatusBadge } from "../components/CouponBadges";
import { CouponCard, couponCardData } from "../components/CouponCard";
import { CouponLoadError } from "../components/CouponLoadError";
import { CouponReviewCard } from "../components/CouponReviewActions";
import { StockGrid } from "../components/StockGrid";
import { deadlineModeOf, deadlineRule } from "../lib/deadline";
import { couponPeriodLong } from "../lib/period";

const pageSchema = paginationQuerySchema.pick({ page: true });
const HIDE_COLUMNS: ("coupon" | "store")[] = ["coupon", "store"];

export function CouponDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const coupon = useCoupon(id);
  useDocumentTitle(coupon.data?.title ?? "Promoção");

  if (coupon.error)
    return <CouponLoadError error={coupon.error} onRetry={() => void coupon.refetch()} />;
  if (!coupon.data) {
    return (
      <LoadingRegion>
        <Skeleton className="h-12 w-96 max-w-full rounded-full" />
        <SkeletonGrid count={2} className="lg:grid-cols-[26rem_1fr]" itemClassName="h-72" />
        <Skeleton className="h-64 rounded-[1.75rem]" />
      </LoadingRegion>
    );
  }

  const c = coupon.data;
  return (
    <>
      <PageHeader
        title={
          <>
            {c.title} <DemoMark show={c.isDemo} />
          </>
        }
        back={{ to: PATHS.coupons, label: "Promoções" }}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <CouponStatusBadge coupon={c} withHint />
            <CouponReviewBadge review={c.review} />
            {c.store.name}
          </span>
        }
        actions={<CouponHeaderActions coupon={c} onDeleted={() => navigate(PATHS.coupons)} />}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <CouponReviewCard coupon={c} />
          <div className="vidro rounded-[2rem] p-2">
            <CouponCard data={couponCardData(c)} />
          </div>
          <CouponInfo coupon={c} />
        </div>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader
              title={
                c.stock.remaining > 0 ? (
                  <>
                    Restam <span className="text-red-700">{formatNumber(c.stock.remaining)}</span>{" "}
                    de {formatNumber(c.stock.total)}
                  </>
                ) : (
                  "Esgotado por enquanto"
                )
              }
              description={
                deadlineModeOf(c) === "hours"
                  ? "Cada quadrado é um cupom. Se o prazo de alguém vence sem uso, ele volta."
                  : "Cada quadrado é um cupom. O prazo é o mesmo para todos: depois dele, ninguém pega mais."
              }
            />
            <StockGrid stock={c.stock} />
          </Card>
          <CouponRules coupon={c} />
          <CouponChallengesCard couponId={c.id} />
        </div>
      </div>

      <CouponClaims coupon={c} />
    </>
  );
}

function CouponInfo({ coupon: c }: { coupon: Coupon }) {
  const { can } = useAuth();
  return (
    <Card>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <InfoItem label="Loja" icon={Store}>
          {can("stores.view") ? (
            <Link to={PATHS.store(c.store.id)} className="hover:underline">
              {c.store.name}
            </Link>
          ) : (
            c.store.name
          )}
        </InfoItem>
        <InfoItem label="Período" icon={CalendarDays}>
          <span className="whitespace-normal">{couponPeriodLong(c)}</span>
        </InfoItem>
        {c.scheduleNote && (
          <InfoItem label="Quando vale (no app)" icon={Clock}>
            {c.scheduleNote}
          </InfoItem>
        )}
        <InfoItem label="Economia por uso" icon={PiggyBank}>
          {c.savingsCents != null ? formatCents(c.savingsCents) : "Não informada"}
        </InfoItem>
      </div>
      {c.description && (
        <p className="mt-4 border-t border-neutral-900/[0.06] pt-4 text-sm whitespace-pre-line text-neutral-700">
          {c.description}
        </p>
      )}
      <p className="mt-4 text-xs text-neutral-400">
        Criada em {formatDateTime(c.createdAt)} · atualizada em {formatDateTime(c.updatedAt)}
      </p>
    </Card>
  );
}

/** As regras que o visitante lê no app antes de pegar. */
function CouponRules({ coupon: c }: { coupon: Coupon }) {
  const fixed = deadlineModeOf(c) !== "hours";
  const rules: { icon: LucideIcon; title: string; text: string }[] = [
    { icon: Timer, ...deadlineRule(c) },
    // Com data fixa (ou até o fim), o prazo de todos acaba junto: não há "volta" depois.
    ...(fixed
      ? []
      : [
          {
            icon: RotateCcw,
            title: "Não usou? Ele volta",
            text: "Se o prazo de alguém acabar sem uso, o cupom volta para outra pessoa pegar.",
          },
        ]),
    {
      icon: Fingerprint,
      title: "Código único",
      text: "Vale uma vez, um por pessoa (ARP-XXXXXX).",
    },
    {
      icon: Ticket,
      title: "Mostre no caixa",
      text: `A ${c.store.name} valida o código em Validar cupom.`,
    },
  ];
  return (
    <Card>
      <CardHeader title="Regras" description="Como aparecem para o visitante no app." />
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rules.map((r) => (
          <li key={r.title} className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-marca/15 text-green-800">
              <r.icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <b className="block text-sm font-semibold text-neutral-900">{r.title}</b>
              <span className="text-xs text-neutral-500">{r.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function CouponClaims({ coupon: c }: { coupon: Coupon }) {
  const [query, setQuery] = useUrlState(pageSchema);
  const claims = useClaims({ couponId: c.id, page: query.page, pageSize: 10 });
  return (
    <Card className="mt-4">
      <CardHeader
        title="Cupons pegos desta promoção"
        description="Quem pegou, quando e se já usou."
        icon={Wallet}
        action={
          <ButtonLink to={PATHS.claimsWith({ couponId: c.id })} variant="ghost" size="sm">
            Ver todos com filtros
          </ButtonLink>
        }
      />
      {claims.error ? (
        <ErrorState compact error={claims.error} onRetry={() => void claims.refetch()} />
      ) : (
        <>
          <ClaimsTable
            caption={`Cupons pegos de ${c.title}`}
            rows={claims.data?.data}
            loading={claims.isLoading}
            hide={HIDE_COLUMNS}
            empty={
              <EmptyState
                compact
                icon={Ticket}
                title="Ninguém pegou ainda"
                description={
                  c.status === "active"
                    ? "Assim que um visitante pegar no app, o código aparece aqui."
                    : "Publique a promoção para ela aparecer no app."
                }
              />
            }
          />
          {claims.data && (
            <Pagination meta={claims.data.meta} onPageChange={(page) => setQuery({ page })} />
          )}
        </>
      )}
    </Card>
  );
}

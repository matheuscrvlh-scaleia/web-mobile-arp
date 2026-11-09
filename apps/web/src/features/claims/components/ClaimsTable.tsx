import type { CouponClaim } from "@arp/contracts";
import { ClipboardCheck } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { Link } from "react-router";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { formatDateTime, formatRelative } from "@/shared/lib/format";
import { ButtonLink, type Column, DemoMark, Table } from "@/shared/ui";
import { ClaimStatusBadge } from "./ClaimStatusBadge";

export type HideableColumn = "coupon" | "store" | "visitor";

const NO_HIDE: HideableColumn[] = [];

/** Código do cupom pego em fonte mono, como no ticket do app. */
export function ClaimCode({ code }: { code: string }) {
  return (
    <code className="rounded-lg bg-neutral-900/[0.06] px-2 py-1 font-mono text-xs font-semibold tracking-wider whitespace-nowrap text-neutral-900">
      {code}
    </code>
  );
}

function When({ iso, prefix }: { iso: string; prefix?: string }) {
  return (
    <time dateTime={iso} title={formatDateTime(iso)} className="whitespace-nowrap">
      {prefix}
      {formatRelative(iso)}
    </time>
  );
}

/** O que aconteceu depois de pegar: usado (quando e por quem), prazo, vencido. */
function Outcome({ claim }: { claim: CouponClaim }) {
  switch (claim.status) {
    case "redeemed":
      // Quem validou vai embaixo, curto: a coluna não empurra o "Validar" para fora.
      return claim.redeemedAt ? (
        <span className="block text-neutral-600">
          <When iso={claim.redeemedAt} prefix="Usado " />
          {claim.redeemedBy && (
            <span
              className="block max-w-40 truncate text-xs text-neutral-400"
              title={claim.redeemedBy.name}
            >
              por {claim.redeemedBy.name}
            </span>
          )}
        </span>
      ) : (
        "Usado"
      );
    case "active":
      return (
        <span className="text-neutral-600">
          <When iso={claim.expiresAt} prefix="Vence " />
        </span>
      );
    case "expired":
      return (
        <span className="text-neutral-500">
          <When iso={claim.expiresAt} prefix="Venceu " />
        </span>
      );
    case "cancelled":
      return <span className="text-neutral-400">—</span>;
  }
}

/** Tabela de cupons pegos (lista geral e o detalhe da promoção). */
export function ClaimsTable({
  rows,
  loading,
  caption,
  empty,
  hide = NO_HIDE,
}: {
  rows: CouponClaim[] | undefined;
  loading: boolean;
  caption: string;
  empty?: ReactNode;
  hide?: HideableColumn[];
}) {
  const { can } = useAuth();
  const canVisitors = can("visitors.view");
  const canRedeem = can("coupons.redeem");
  const showStore = !hide.includes("store");
  const columns = useMemo(() => {
    const all: (Column<CouponClaim> & { id?: HideableColumn })[] = [
      {
        key: "code",
        header: "Código",
        primary: true,
        // No desktop, "pegou há…" fica sob o código (uma coluna a menos).
        cell: (c) => (
          <span className="inline-flex flex-col items-start gap-1">
            <ClaimCode code={c.code} />
            <span className="hidden text-xs font-normal whitespace-nowrap text-neutral-500 md:block">
              <When iso={c.claimedAt} prefix="pegou " />
            </span>
          </span>
        ),
      },
      {
        key: "visitor",
        id: "visitor",
        header: "Visitante",
        cell: (c) =>
          canVisitors ? (
            <Link
              to={PATHS.visitor(c.visitor.id)}
              className="inline-flex items-center gap-1.5 font-medium hover:underline"
            >
              <span className="max-w-40 truncate">{c.visitor.name}</span>
              <DemoMark show={c.isDemo} />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="max-w-40 truncate">{c.visitor.name}</span>
              <DemoMark show={c.isDemo} />
            </span>
          ),
      },
      {
        key: "coupon",
        id: "coupon",
        header: "Promoção",
        cell: (c) => (
          <Link
            to={PATHS.coupon(c.coupon.id)}
            className="block max-w-full hover:underline md:max-w-48"
          >
            <span className="block truncate" title={c.coupon.title}>
              {c.coupon.title}
            </span>
            {/* A loja vai no subtítulo, junto do destaque (uma coluna a menos). */}
            <span className="block truncate text-xs text-neutral-500">
              {c.coupon.headline}
              {showStore && ` · ${c.store.name}`}
            </span>
          </Link>
        ),
      },
      {
        key: "status",
        header: "Situação",
        status: true,
        cell: (c) => <ClaimStatusBadge status={c.status} />,
      },
      {
        key: "claimedAt",
        header: "Pegou",
        cell: (c) => (
          <span className="text-neutral-600">
            <When iso={c.claimedAt} />
          </span>
        ),
        // Só no cartão do celular: no desktop está sob o código.
        className: "md:hidden",
      },
      { key: "outcome", header: "Uso / prazo", cell: (c) => <Outcome claim={c} /> },
      ...(canRedeem
        ? [
            {
              key: "actions",
              header: <span className="sr-only">Ações</span>,
              numeric: true,
              actions: true,
              // Aguardando uso: atalho para validar no caixa já com o código.
              cell: (c: CouponClaim) =>
                c.status === "active" ? (
                  <ButtonLink
                    data-guia="validar"
                    to={PATHS.redeemCode(c.code)}
                    size="sm"
                    variant="secondary"
                    icon={ClipboardCheck}
                    aria-label={`Validar ${c.code}`}
                  >
                    Validar
                  </ButtonLink>
                ) : null,
            },
          ]
        : []),
    ];
    return all.filter((c) => !c.id || !hide.includes(c.id));
  }, [canVisitors, canRedeem, hide, showStore]);

  return (
    <Table
      caption={caption}
      columns={columns}
      rows={rows}
      rowKey={(c) => c.id}
      loading={loading}
      empty={empty}
      mobile="cards"
    />
  );
}

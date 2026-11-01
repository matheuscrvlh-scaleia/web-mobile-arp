import type { CouponClaim } from "@arp/contracts";
import { type ReactNode, useMemo } from "react";
import { Link } from "react-router";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { formatDateTime, formatRelative } from "@/shared/lib/format";
import { type Column, Table } from "@/shared/ui";
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
      return claim.redeemedAt ? (
        <span className="text-neutral-600">
          <When iso={claim.redeemedAt} prefix="Usado " />
          {claim.redeemedBy && <span className="text-neutral-400"> · {claim.redeemedBy.name}</span>}
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
  const columns = useMemo(() => {
    const all: (Column<CouponClaim> & { id?: HideableColumn })[] = [
      { key: "code", header: "Código", cell: (c) => <ClaimCode code={c.code} /> },
      {
        key: "visitor",
        id: "visitor",
        header: "Visitante",
        cell: (c) =>
          canVisitors ? (
            <Link to={PATHS.visitor(c.visitor.id)} className="font-medium hover:underline">
              {c.visitor.name}
            </Link>
          ) : (
            <span className="font-medium">{c.visitor.name}</span>
          ),
      },
      {
        key: "coupon",
        id: "coupon",
        header: "Promoção",
        cell: (c) => (
          <Link to={PATHS.coupon(c.coupon.id)} className="block max-w-64 hover:underline">
            <span className="block truncate">{c.coupon.title}</span>
            <span className="block text-xs text-neutral-500">{c.coupon.headline}</span>
          </Link>
        ),
      },
      {
        key: "store",
        id: "store",
        header: "Loja",
        cell: (c) => c.store.name,
        className: "hidden lg:table-cell",
      },
      { key: "status", header: "Situação", cell: (c) => <ClaimStatusBadge status={c.status} /> },
      {
        key: "claimedAt",
        header: "Pegou",
        cell: (c) => (
          <span className="text-neutral-600">
            <When iso={c.claimedAt} />
          </span>
        ),
        className: "hidden md:table-cell",
      },
      { key: "outcome", header: "Uso / prazo", cell: (c) => <Outcome claim={c} /> },
    ];
    return all.filter((c) => !c.id || !hide.includes(c.id));
  }, [canVisitors, hide]);

  return (
    <Table
      caption={caption}
      columns={columns}
      rows={rows}
      rowKey={(c) => c.id}
      loading={loading}
      empty={empty}
    />
  );
}

import type { VisitorDetail } from "@arp/contracts";
import {
  Ban,
  CalendarClock,
  EyeOff,
  History,
  Mail,
  Phone,
  ShieldCheck,
  Unlock,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { formatDate, formatDateTime, formatRelative } from "@/shared/lib/format";
import { ActionMenu, Button, Can, DemoMark } from "@/shared/ui";
import { OptInBadge, PROVIDER_LABEL, VisitorAvatar, VisitorStatusBadge } from "./VisitorBadges";
import {
  AnonymizeVisitorModal,
  BlockVisitorModal,
  UnblockVisitorDialog,
} from "./VisitorStatusDialogs";

/** Topo do visitante: quem é, como entra, situação e bloquear/desbloquear. */
export function VisitorHero({ visitor }: { visitor: VisitorDetail }) {
  const [dialog, setDialog] = useState<"block" | "unblock" | "anonymize" | null>(null);
  const blocked = visitor.status === "blocked";
  const anonymized = Boolean(visitor.anonymizedAt);
  const { can } = useAuth();
  const navigate = useNavigate();
  const historyHref = `${PATHS.audit}?entityType=visitor&entityId=${encodeURIComponent(visitor.id)}`;
  return (
    <section
      aria-labelledby="visitante-nome"
      className="tom-escuro relative isolate overflow-hidden rounded-[2rem] p-6 md:p-8"
    >
      <div className="flex flex-wrap items-start gap-5">
        <VisitorAvatar name={visitor.name} url={visitor.avatarUrl} muted={blocked} size="xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <VisitorStatusBadge status={visitor.status} anonymized={anonymized} />
            {!anonymized && <OptInBadge optIn={visitor.marketingOptIn} />}
          </div>
          <h1
            id="visitante-nome"
            className="mt-3 text-3xl font-semibold tracking-tight text-balance md:text-4xl"
          >
            {visitor.name}
            <DemoMark show={visitor.isDemo} className="ml-2 size-7 [&>svg]:size-4" />
          </h1>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-neutral-600">
            {!anonymized && (
              <li className="flex min-w-0 items-center gap-1.5">
                <Mail className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{visitor.email}</span>
              </li>
            )}
            {visitor.phone && (
              <li className="flex items-center gap-1.5">
                <Phone className="size-4 shrink-0" aria-hidden />
                {visitor.phone}
              </li>
            )}
            {!anonymized && (
              <li className="flex items-center gap-1.5">
                <ShieldCheck className="size-4 shrink-0" aria-hidden />
                Entra com {PROVIDER_LABEL[visitor.authProvider]}
              </li>
            )}
            <li className="flex flex-wrap items-center gap-x-1.5">
              <CalendarClock className="size-4 shrink-0" aria-hidden />
              Desde {formatDate(visitor.createdAt)}
              {visitor.lastSeenAt && (
                <span title={formatDateTime(visitor.lastSeenAt)}>
                  {" "}
                  · visto {formatRelative(visitor.lastSeenAt)}
                </span>
              )}
            </li>
          </ul>
        </div>
        <div className="flex basis-full flex-wrap items-center gap-2 sm:basis-auto">
          <Can permission="visitors.manage">
            {anonymized ? null : blocked ? (
              <Button variant="brand" icon={Unlock} onClick={() => setDialog("unblock")}>
                Desbloquear
              </Button>
            ) : (
              <Button variant="secondary" icon={Ban} onClick={() => setDialog("block")}>
                Bloquear
              </Button>
            )}
          </Can>
          <ActionMenu
            label="Mais"
            ariaLabel={`Mais ações de ${visitor.name}`}
            items={[
              can("audit.view") && {
                label: "Ver no Histórico",
                icon: History,
                onSelect: () => navigate(historyHref),
              },
              can("visitors.manage") &&
                !anonymized && {
                  label: "Anonimizar dados (LGPD)",
                  icon: EyeOff,
                  danger: true,
                  onSelect: () => setDialog("anonymize"),
                },
            ]}
          />
        </div>
      </div>
      {anonymized && visitor.anonymizedAt && (
        <p className="mt-5 flex items-start gap-2 rounded-2xl bg-neutral-100 px-4 py-3 text-sm text-neutral-700">
          <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          Dados pessoais apagados em {formatDate(visitor.anonymizedAt)} a pedido (LGPD). Os números
          continuam, sem dizer de quem são.
        </p>
      )}
      {blocked && !anonymized && (
        <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <b className="font-semibold">Bloqueado.</b>{" "}
          {visitor.blockedReason ? `Motivo: ${visitor.blockedReason}` : "Sem motivo registrado."}
        </p>
      )}
      {!visitor.termsAcceptedAt && !anonymized && (
        <p className="mt-3 text-xs text-neutral-500">Ainda não aceitou os termos de uso.</p>
      )}
      <BlockVisitorModal
        open={dialog === "block"}
        visitor={visitor}
        onClose={() => setDialog(null)}
      />
      <AnonymizeVisitorModal
        open={dialog === "anonymize"}
        visitor={visitor}
        onClose={() => setDialog(null)}
      />
      <UnblockVisitorDialog
        open={dialog === "unblock"}
        visitor={visitor}
        onClose={() => setDialog(null)}
      />
    </section>
  );
}

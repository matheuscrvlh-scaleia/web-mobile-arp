import type { Campaign, Challenge, QrCode } from "@arp/contracts";
import {
  Ban,
  CalendarClock,
  CalendarRange,
  CircleCheck,
  CirclePause,
  Clock,
  Copy,
  EyeOff,
  Flag,
  MonitorPlay,
  Pencil,
  Plus,
  Printer,
  QrCode as QrIcon,
  RotateCcw,
  TimerOff,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { formatDateTime, formatNumber } from "@/shared/lib/format";
import {
  Button,
  ButtonLink,
  Can,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  IconButton,
  Skeleton,
  StatusBadge,
  type StatusTone,
  toast,
} from "@/shared/ui";
import { useQrCodes, useUpdateQrCode } from "../api";
import {
  challengePeriod,
  type QrContext,
  type QrState,
  qrCoverage,
  qrState,
  qrWindowText,
} from "../lib/qr";
import { QrBatchModal } from "./QrBatchModal";
import { QrCodeFormModal } from "./QrCodeFormModal";
import { QrPngButton } from "./QrPngButton";
import { QrPrintModal } from "./QrPrintModal";

type Dialog =
  | { kind: "create" }
  | { kind: "edit"; qr: QrCode }
  | { kind: "print"; qr: QrCode }
  | { kind: "batch" }
  | null;

/**
 * QR Codes do desafio: gerar, imprimir, baixar, editar e revogar. A
 * situação de cada QR considera a campanha e o desafio (o que o app vai
 * responder no scan). A equipe da ARP vê os QR de todos; o lojista, os seus.
 */
export function QrCodesSection({
  challenge,
  campaign,
}: {
  challenge: Challenge;
  campaign?: Campaign;
}) {
  const { user } = useAuth();
  const qrCodes = useQrCodes(challenge.id);
  const update = useUpdateQrCode();
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);
  const ctx: QrContext = { campaign, challenge };
  const period = campaign ? challengePeriod({ campaign, challenge }) : null;

  if (challenge.validation === "auto") {
    return (
      <Card>
        <EmptyState
          compact
          icon={Zap}
          title="Validação automática"
          description="Este desafio não usa QR Code: o sistema dá o selo sozinho quando o visitante cumpre a ação (ex.: pagar o estacionamento pelo app)."
        />
      </Card>
    );
  }

  const setStatus = (qr: QrCode, status: QrCode["status"], undo?: () => void) =>
    update.mutate(
      { id: qr.id, body: { status } },
      {
        onSuccess: () =>
          toast.success(
            status === "revoked"
              ? `QR "${qr.label}" revogado: parou de dar selo.`
              : `QR "${qr.label}" reativado.`,
            undo ? { action: { label: "Desfazer", onClick: undo } } : undefined,
          ),
        onError: (e) => toast.fromError(e),
      },
    );

  const list = [...(qrCodes.data ?? [])].sort(
    (a, b) => Number(a.status === "revoked") - Number(b.status === "revoked"),
  );
  // Cobertura: o QR fixo valendo que vai mais longe já cobre o fim do desafio?
  const live = list.filter((q) => q.status === "active" && !q.rotating);
  const lastUntil = Math.max(0, ...live.map((q) => new Date(q.validUntil ?? 0).getTime()));
  const gap =
    period && live.length > 0 && lastUntil < period.end && lastUntil > Date.now()
      ? new Date(lastUntil).toISOString()
      : null;
  // Todos vencem antes de o desafio começar (cartaz feito cedo demais).
  const allBefore = gap !== null && period !== null && lastUntil <= period.start;
  // Cartazes do mês: campanha conhecida, fora do arquivo e com período pela frente.
  const canBatch =
    campaign !== undefined &&
    campaign.status !== "archived" &&
    period !== null &&
    period.end > Date.now();

  return (
    <Card>
      <CardHeader
        title="QR Codes"
        description={
          user?.store
            ? "Todo QR Code tem prazo. Você vê os que gerou. Fixo: imprima; telão: abra em tela cheia."
            : "Todo QR Code tem prazo (o impresso vale até 7 dias). Fixo: imprima; telão: abra em tela cheia."
        }
        icon={QrIcon}
        action={
          <Can permission="qr_codes.generate">
            <span className="flex flex-wrap gap-2">
              {canBatch && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={CalendarRange}
                  onClick={() => setDialog({ kind: "batch" })}
                >
                  Gerar cartazes do mês
                </Button>
              )}
              <Button size="sm" icon={Plus} onClick={() => setDialog({ kind: "create" })}>
                Gerar QR Code
              </Button>
            </span>
          </Can>
        }
      />
      {gap && (
        <p
          aria-live="polite"
          className="mb-3 flex gap-2 rounded-2xl bg-amber-500/15 px-4 py-3 text-sm text-amber-950"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {allBefore && period ? (
            <span>
              Os QR impressos vencem em <strong>{formatDateTime(gap)}</strong>, antes de o desafio
              começar ({formatDateTime(new Date(period.start))}). Gere um QR novo: ele já vem
              começando junto com o desafio.
            </span>
          ) : (
            <span>
              Os QR impressos valem até <strong>{formatDateTime(gap)}</strong>, antes do fim do
              desafio. Gere outro QR até lá e troque o cartaz, ou use "Gerar cartazes do mês" para
              imprimir todas as semanas de uma vez.
            </span>
          )}
        </p>
      )}
      {qrCodes.error ? (
        <ErrorState compact error={qrCodes.error} onRetry={() => void qrCodes.refetch()} />
      ) : !qrCodes.data ? (
        <div aria-busy className="flex flex-col gap-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          compact
          icon={QrIcon}
          title="Nenhum QR Code ainda"
          description="Gere o QR Code e imprima o cartaz para o desafio começar a dar selos."
        />
      ) : (
        <ul aria-label="QR Codes do desafio" className="flex flex-col gap-3">
          {list.map((qr) => (
            <QrCodeItem
              key={qr.id}
              qr={qr}
              state={qrState(qr, ctx)}
              coverage={period ? qrCoverage(qr, period) : "ok"}
              onPrint={() => setDialog({ kind: "print", qr })}
              onEdit={() => setDialog({ kind: "edit", qr })}
              onRevoke={() => setStatus(qr, "revoked", () => setStatus(qr, "active"))}
              onReactivate={() => setStatus(qr, "active")}
              busy={update.isPending && update.variables?.id === qr.id}
            />
          ))}
        </ul>
      )}

      {(dialog?.kind === "create" || dialog?.kind === "edit") && (
        <QrCodeFormModal
          challenge={challenge}
          campaign={campaign}
          qrCode={dialog.kind === "edit" ? dialog.qr : undefined}
          onClose={close}
          onCreated={(qr) =>
            qr.rotating
              ? window.open(PATHS.qrScreen(qr.id), "_blank")
              : setDialog({ kind: "print", qr })
          }
        />
      )}
      <QrPrintModal
        qr={dialog?.kind === "print" ? dialog.qr : null}
        challenge={challenge}
        onClose={close}
      />
      {dialog?.kind === "batch" && campaign && (
        <QrBatchModal campaign={campaign} challenges={[challenge]} onClose={close} />
      )}
    </Card>
  );
}

const STATE_BADGE: Record<QrState, { tone: StatusTone; label: string; icon: typeof Ban }> = {
  active: { tone: "success", label: "Valendo", icon: CircleCheck },
  scheduled: { tone: "info", label: "Ainda não começou", icon: CalendarClock },
  expired: { tone: "warning", label: "Vencido", icon: TimerOff },
  revoked: { tone: "neutral", label: "Revogado", icon: Ban },
  paused: { tone: "warning", label: "Parado: desafio pausado", icon: CirclePause },
  unpublished: { tone: "neutral", label: "Parado: campanha arquivada", icon: EyeOff },
  awaiting: { tone: "info", label: "Aguardando publicação", icon: CalendarClock },
  waiting: { tone: "info", label: "Aguardando o desafio começar", icon: CalendarClock },
  ended: { tone: "neutral", label: "Desafio encerrado", icon: Flag },
};

function QrCodeItem({
  qr,
  state,
  coverage,
  onPrint,
  onEdit,
  onRevoke,
  onReactivate,
  busy,
}: {
  qr: QrCode;
  state: QrState;
  coverage: "before" | "partial" | "ok";
  onPrint: () => void;
  onEdit: () => void;
  onRevoke: () => void;
  onReactivate: () => void;
  busy: boolean;
}) {
  const { can } = useAuth();
  const manage = can("challenges.manage");
  const badge = STATE_BADGE[state];
  const revoked = state === "revoked";
  return (
    <li className="flex flex-wrap items-center gap-4 rounded-3xl border border-neutral-900/[0.06] bg-white/40 p-3">
      <span
        className={
          revoked ? "rounded-2xl bg-[#fff] p-2 opacity-40 grayscale" : "rounded-2xl bg-[#fff] p-2"
        }
      >
        <QRCodeSVG value={qr.payload} size={72} level="M" title={`QR Code ${qr.label}`} />
      </span>
      <div className="min-w-48 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-neutral-900">{qr.label}</p>
          <StatusBadge tone={badge.tone} icon={badge.icon}>
            {badge.label}
          </StatusBadge>
          {!revoked && state !== "expired" && coverage === "before" && (
            <StatusBadge tone="warning" icon={TriangleAlert}>
              Vence antes do desafio começar
            </StatusBadge>
          )}
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500">
          <Clock className="size-3.5 shrink-0" aria-hidden />
          {qrWindowText(qr)}
          {qr.createdBy && ` · gerado por ${qr.createdBy.name}`}
        </p>
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
          <Scan label={["selo dado", "selos dados"]} value={qr.scans.awarded} icon={CircleCheck} />
          <Scan
            label={["leitura repetida", "leituras repetidas"]}
            value={qr.scans.duplicate}
            icon={Copy}
          />
          <Scan
            label={["fora do prazo", "fora do prazo"]}
            value={qr.scans.expired}
            icon={TimerOff}
          />
        </dl>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {!revoked && qr.rotating && (
          <ButtonLink size="sm" icon={MonitorPlay} to={PATHS.qrScreen(qr.id)} target="_blank">
            Abrir telão<span className="sr-only"> {qr.label}</span>
          </ButtonLink>
        )}
        {!revoked && !qr.rotating && state !== "expired" && (
          <>
            <Button size="sm" icon={Printer} onClick={onPrint}>
              Imprimir<span className="sr-only"> {qr.label}</span>
            </Button>
            <QrPngButton qr={qr} />
          </>
        )}
        {manage && (
          <>
            <IconButton icon={Pencil} label={`Editar ${qr.label}`} size="sm" onClick={onEdit} />
            {revoked ? (
              <Button
                size="sm"
                variant="ghost"
                icon={RotateCcw}
                loading={busy}
                onClick={onReactivate}
              >
                Reativar<span className="sr-only"> {qr.label}</span>
              </Button>
            ) : (
              <Button size="sm" variant="ghost" icon={Ban} loading={busy} onClick={onRevoke}>
                Revogar<span className="sr-only"> {qr.label}</span>
              </Button>
            )}
          </>
        )}
      </div>
    </li>
  );
}

function Scan({
  label: [one, many],
  value,
  icon: Icon,
}: {
  label: [string, string];
  value: number;
  icon: typeof Ban;
}) {
  const label = value === 1 ? one : many;
  return (
    <div className="flex items-center gap-1">
      <Icon className="size-3.5" aria-hidden />
      <dt className="sr-only">{many}</dt>
      <dd>
        <b className="font-semibold tabular-nums">{formatNumber(value)}</b>{" "}
        <span aria-hidden>{label}</span>
      </dd>
    </div>
  );
}

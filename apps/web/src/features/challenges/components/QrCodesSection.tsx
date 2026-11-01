import type { Challenge, QrCode } from "@arp/contracts";
import {
  Ban,
  CalendarClock,
  CircleCheck,
  Clock,
  Copy,
  Pencil,
  Plus,
  Printer,
  QrCode as QrIcon,
  RotateCcw,
  TimerOff,
  Zap,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { useAuth } from "@/shared/auth";
import { formatNumber } from "@/shared/lib/format";
import {
  Button,
  Can,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  Skeleton,
  StatusBadge,
  toast,
} from "@/shared/ui";
import { useQrCodes, useUpdateQrCode } from "../api";
import { type QrState, qrState, qrWindowText } from "../lib/qr";
import { QrCodeFormModal } from "./QrCodeFormModal";
import { QrPngButton } from "./QrPngButton";
import { QrPrintModal } from "./QrPrintModal";

type Dialog =
  | { kind: "create" }
  | { kind: "edit"; qr: QrCode }
  | { kind: "revoke"; qr: QrCode }
  | { kind: "print"; qr: QrCode }
  | null;

/** QR Codes do desafio: gerar, imprimir, baixar, editar janela e revogar. */
export function QrCodesSection({ challenge }: { challenge: Challenge }) {
  const qrCodes = useQrCodes(challenge.id);
  const update = useUpdateQrCode();
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => {
    update.reset();
    setDialog(null);
  };

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

  const list = [...(qrCodes.data ?? [])].sort(
    (a, b) => Number(a.status === "revoked") - Number(b.status === "revoked"),
  );

  return (
    <Card>
      <CardHeader
        title="QR Codes"
        description="O visitante lê no app e ganha o selo uma vez. Imprima e deixe onde o desafio acontece."
        icon={QrIcon}
        action={
          <Can permission="challenges.manage">
            <Button size="sm" icon={Plus} onClick={() => setDialog({ kind: "create" })}>
              Gerar QR Code
            </Button>
          </Can>
        }
      />
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
              onPrint={() => setDialog({ kind: "print", qr })}
              onEdit={() => setDialog({ kind: "edit", qr })}
              onRevoke={() => setDialog({ kind: "revoke", qr })}
              onReactivate={() =>
                update.mutate(
                  { id: qr.id, body: { status: "active" } },
                  {
                    onSuccess: () => toast.success("QR Code reativado."),
                    onError: (e) => toast.fromError(e),
                  },
                )
              }
              reactivating={update.isPending && update.variables?.id === qr.id}
            />
          ))}
        </ul>
      )}

      {(dialog?.kind === "create" || dialog?.kind === "edit") && (
        <QrCodeFormModal
          challengeId={challenge.id}
          qrCode={dialog.kind === "edit" ? dialog.qr : undefined}
          onClose={close}
          onCreated={(qr) => setDialog({ kind: "print", qr })}
        />
      )}
      <QrPrintModal
        qr={dialog?.kind === "print" ? dialog.qr : null}
        challenge={challenge}
        onClose={close}
      />
      <ConfirmDialog
        open={dialog?.kind === "revoke"}
        onClose={close}
        danger
        title="Revogar este QR Code?"
        description={
          dialog?.kind === "revoke"
            ? `"${dialog.qr.label}" para de dar selo na hora. Cartazes impressos com ele deixam de valer. Dá para reativar depois.`
            : undefined
        }
        confirmLabel="Revogar"
        loading={update.isPending}
        error={update.error}
        onConfirm={() => {
          if (dialog?.kind !== "revoke") return;
          update.mutate(
            { id: dialog.qr.id, body: { status: "revoked" } },
            {
              onSuccess: () => {
                toast.success("QR Code revogado.");
                close();
              },
            },
          );
        }}
      />
    </Card>
  );
}

const STATE_BADGE: Record<
  QrState,
  { tone: "success" | "info" | "warning" | "neutral"; label: string; icon: typeof Ban }
> = {
  active: { tone: "success", label: "Valendo", icon: CircleCheck },
  scheduled: { tone: "info", label: "Ainda não começou", icon: CalendarClock },
  expired: { tone: "warning", label: "Fora da janela", icon: TimerOff },
  revoked: { tone: "neutral", label: "Revogado", icon: Ban },
};

function QrCodeItem({
  qr,
  onPrint,
  onEdit,
  onRevoke,
  onReactivate,
  reactivating,
}: {
  qr: QrCode;
  onPrint: () => void;
  onEdit: () => void;
  onRevoke: () => void;
  onReactivate: () => void;
  reactivating: boolean;
}) {
  const { can } = useAuth();
  const manage = can("challenges.manage");
  const state = qrState(qr);
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
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500">
          <Clock className="size-3.5 shrink-0" aria-hidden />
          {qrWindowText(qr)}
        </p>
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
          <Scan label="selos dados" value={qr.scans.awarded} icon={CircleCheck} />
          <Scan label="leituras repetidas" value={qr.scans.duplicate} icon={Copy} />
          <Scan label="fora do prazo" value={qr.scans.expired} icon={TimerOff} />
        </dl>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {!revoked && (
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
                loading={reactivating}
                onClick={onReactivate}
              >
                Reativar
              </Button>
            ) : (
              <IconButton
                icon={Ban}
                variant="danger"
                label={`Revogar ${qr.label}`}
                size="sm"
                onClick={onRevoke}
              />
            )}
          </>
        )}
      </div>
    </li>
  );
}

function Scan({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Ban }) {
  return (
    <div className="flex items-center gap-1">
      <Icon className="size-3.5" aria-hidden />
      <dt className="sr-only">{label}</dt>
      <dd>
        <b className="font-semibold tabular-nums">{formatNumber(value)}</b>{" "}
        <span aria-hidden>{label}</span>
      </dd>
    </div>
  );
}

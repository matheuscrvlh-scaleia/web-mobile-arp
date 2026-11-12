import type { PrizeRedemption } from "@arp/contracts";
import { CircleCheckBig, PackageCheck, TicketCheck } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Banner } from "@/features/claims/components/RedeemFeedback";
import { errorMessage } from "@/shared/api";
import { formatDateTime, formatNumber } from "@/shared/lib/format";
import { Button, Card, CardHeader, Input, toast } from "@/shared/ui";
import { clubApi, useDeliverRedemption } from "../api";

/** Só letras e números, em maiúsculas (o visitante pode ditar com espaço ou traço). */
const normalize = (v: string) => v.replace(/[^a-z0-9]/gi, "").toUpperCase();

/**
 * Mercado Local: o visitante trocou os Trevos no app e mostra o código. A
 * equipe digita, confere o prêmio e entrega. Pendente vencido ou cancelado
 * não entrega (a API recusa).
 */
export function DeliverCodeCard() {
  const [code, setCode] = useState("");
  const [found, setFound] = useState<PrizeRedemption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [delivered, setDelivered] = useState<PrizeRedemption | null>(null);
  const deliver = useDeliverRedemption();

  const lookup = async (e: FormEvent) => {
    e.preventDefault();
    const q = normalize(code);
    setFound(null);
    setDelivered(null);
    setError(null);
    if (q.length < 6) {
      setError("O código tem 6 letras e números (ex.: K7Q2MX).");
      return;
    }
    setSearching(true);
    try {
      const page = await clubApi.redemptions({ page: 1, pageSize: 1, q });
      const r = page.data.find((x) => x.code === q);
      if (!r) setError("Nenhuma troca com esse código. Confira com o visitante.");
      else if (r.status === "delivered")
        setError(`Este prêmio já foi entregue em ${formatDateTime(r.deliveredAt ?? r.createdAt)}.`);
      else if (r.status === "cancelled")
        setError("Esta troca foi cancelada (o prazo venceu ou o visitante desistiu).");
      else if (r.expiresAt && new Date(r.expiresAt) <= new Date())
        setError("O prazo para retirar venceu. O visitante pode trocar de novo pelo app.");
      else setFound(r);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSearching(false);
    }
  };

  const confirm = () => {
    if (!found) return;
    deliver.mutate(found.id, {
      onSuccess: (r) => {
        setDelivered(r);
        setFound(null);
        setCode("");
        toast.success(`Entregue: ${r.prize.name} para ${r.visitor.name}.`);
      },
      onError: (e) => setError(errorMessage(e)),
    });
  };

  return (
    <Card data-guia="validar-codigo">
      <CardHeader
        title="Validar código do app"
        description="O visitante trocou os Trevos no app e mostra um código de 6 letras. Digite, confira o prêmio e entregue."
        icon={TicketCheck}
      />
      <form onSubmit={lookup} className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Código da troca"
          placeholder="Ex.: K7Q2MX"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
          className="w-full font-mono uppercase tracking-widest sm:w-56"
        />
        <Button type="submit" variant="primary" loading={searching}>
          Conferir
        </Button>
      </form>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      {found && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-neutral-900/[0.04] p-4">
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-neutral-900">{found.prize.name}</p>
            <p className="text-neutral-600">
              {found.visitor.name} · {formatNumber(found.points)} Trevos · retirar até{" "}
              {found.expiresAt ? formatDateTime(found.expiresAt) : "—"}
            </p>
          </div>
          <Button variant="brand" icon={PackageCheck} loading={deliver.isPending} onClick={confirm}>
            Entregar prêmio
          </Button>
        </div>
      )}
      {delivered && (
        <div className="mt-4">
          <Banner tone="success" icon={CircleCheckBig} title="Prêmio entregue!">
            <p>
              <b>{delivered.prize.name}</b> para {delivered.visitor.name} · código{" "}
              <span className="font-mono">{delivered.code}</span>
            </p>
          </Banner>
        </div>
      )}
    </Card>
  );
}

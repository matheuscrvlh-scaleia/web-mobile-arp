import { CalendarDays, Fingerprint, RotateCcw, Timer } from "lucide-react";
import type { ReactNode } from "react";
import { formatNumber } from "@/shared/lib/format";
import { PhoneFrame } from "@/shared/ui";
import { CouponCard, type CouponCardData } from "./CouponCard";

/**
 * Prévia ao vivo no celular: o cartão na lista de cupons e as regras que o
 * visitante lê antes de pegar. Decorativa (o formulário já diz tudo em texto).
 */
export function CouponPreview({
  data,
  scheduleNote,
}: {
  data: CouponCardData;
  scheduleNote: string | null;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="self-start text-xs font-medium text-neutral-500">Prévia no app</p>
      <PhoneFrame>
        <div className="flex h-full flex-col gap-4 px-4 pt-3">
          <p className="text-[26px] font-extrabold tracking-[-0.04em]">Cupons</p>
          <CouponCard data={data} notchClassName="bg-[#f6f5f3]" />
          <div className="rounded-[1.4rem] bg-[#fff] p-4">
            <p className="flex items-baseline justify-between gap-2 text-[15px] font-bold tracking-tight">
              {data.remaining > 0 ? (
                <span>
                  Restam{" "}
                  <em className="text-[#c95a32] not-italic">{formatNumber(data.remaining)}</em> de{" "}
                  {formatNumber(data.total)}
                </span>
              ) : (
                <span>Esgotado por enquanto</span>
              )}
            </p>
            {scheduleNote && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#f1ece7] px-2.5 py-1 text-[11px] font-semibold">
                <CalendarDays className="size-3" />
                {scheduleNote}
              </p>
            )}
            <ul className="mt-3 flex flex-col gap-2.5">
              <Rule
                icon={<Timer className="size-4" />}
                title={`${data.redeemWindowHours} horas para usar`}
              >
                O prazo começa quando pega o cupom
              </Rule>
              <Rule icon={<RotateCcw className="size-4" />} title="Não usou? Ele volta">
                Depois do prazo, volta pra outra pessoa
              </Rule>
              <Rule icon={<Fingerprint className="size-4" />} title="Código único">
                Vale uma vez, um por pessoa
              </Rule>
            </ul>
          </div>
        </div>
      </PhoneFrame>
    </div>
  );
}

function Rule({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#eef8ef] text-[#2f7d3d]">
        {icon}
      </span>
      <span className="min-w-0 leading-tight">
        <b className="block text-[13px]">{title}</b>
        <span className="text-[11px] text-[#7c827b]">{children}</span>
      </span>
    </li>
  );
}

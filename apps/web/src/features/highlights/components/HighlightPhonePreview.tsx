import { Bell, Search } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { zonedParts } from "@/shared/lib/dates";
import { PhoneFrame } from "@/shared/ui";
import { HighlightSlide, type SlideContent } from "./HighlightSlide";

const greeting = () => {
  const h = zonedParts(new Date()).hour;
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
};

/**
 * A home do app no celular com o destaque no carrossel do topo (o próximo
 * slide aparece pela metade, como no app) e os pontinhos de posição.
 */
export function HighlightPhonePreview({
  slide,
  next,
  total,
}: {
  slide: SlideContent;
  /** Slide seguinte do carrossel (só para mostrar o "espiar" ao lado). */
  next?: SlideContent;
  /** Quantos slides o carrossel tem com este. */
  total: number;
}) {
  const dots = Math.min(Math.max(total, 1), 6);
  return (
    <PhoneFrame>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-5 pt-3">
          <div>
            <p className="text-[11px] text-[#6b6f6b]">{greeting()}</p>
            <p className="text-lg leading-tight font-extrabold tracking-tight">Explore a ARP</p>
          </div>
          <span className="grid size-9 place-items-center rounded-full bg-[#fff]">
            <Bell className="size-4" />
          </span>
        </div>
        <div className="mx-5 mt-3 flex h-9 items-center gap-2 rounded-full bg-[#fff] px-3 text-[11px] text-[#9aa098]">
          <Search className="size-3.5" />
          Lojas, eventos, cupons…
        </div>
        <div className="mt-4 flex gap-2 overflow-hidden pl-5">
          <HighlightSlide slide={slide} className="w-[15.5rem]" />
          {next && <HighlightSlide slide={next} className="w-[15.5rem] opacity-90" />}
        </div>
        <div className="mt-2.5 flex justify-center gap-1.5">
          {Array.from({ length: dots }, (_, i) => (
            <i
              // biome-ignore lint/suspicious/noArrayIndexKey: pontinhos sem identidade própria
              key={i}
              className={cn(
                "block h-1.5 rounded-full",
                i === 0 ? "w-5 bg-[#141714]" : "w-1.5 bg-[#d6d2cd]",
              )}
            />
          ))}
        </div>
        <div className="mt-5 grid grid-cols-4 gap-3 px-5">
          {["Comer", "Lojas", "Cupons", "Agenda"].map((l) => (
            <span key={l} className="flex flex-col items-center gap-1.5">
              <span className="size-12 rounded-2xl bg-[#fff]" />
              <span className="text-[10px] text-[#6b6f6b]">{l}</span>
            </span>
          ))}
        </div>
        <div className="mx-5 mt-5 h-28 rounded-[1.6rem] bg-[#58c069]/80" />
      </div>
    </PhoneFrame>
  );
}

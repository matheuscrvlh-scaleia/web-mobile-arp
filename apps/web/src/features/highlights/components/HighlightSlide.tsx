import type { HighlightBadge } from "@arp/contracts";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { BADGE_LABEL } from "./HighlightBadges";

export interface SlideContent {
  title: string;
  subtitle: string | null | undefined;
  ctaLabel: string | null | undefined;
  imageUrl: string | null | undefined;
  badge: HighlightBadge;
}

// Medidas do `.slide` do app (350 x 190, base 13px) em "em": a mesma peça
// serve de miniatura e de prévia no celular, só mudando o tamanho da fonte.
const BASE_PX = { thumb: 6.5, phone: 9.4 } as const;

/**
 * Slide do carrossel da home do app: foto com degradê escuro (ou o verde
 * "promo" sem foto), pílula Destaque/Patrocinado, título, subtítulo e o
 * botão branco com seta.
 */
export function HighlightSlide({
  slide,
  size = "phone",
  className,
}: {
  slide: SlideContent;
  size?: keyof typeof BASE_PX;
  className?: string;
}) {
  const promo = !slide.imageUrl;
  return (
    <div
      aria-hidden
      className={cn(
        "relative aspect-[350/190] shrink-0 overflow-hidden rounded-[2.15em] text-left",
        promo ? "text-[#141714]" : "text-[#fff]",
        className,
      )}
      style={{
        fontSize: BASE_PX[size],
        background: promo
          ? "radial-gradient(circle at 85% 20%, #8be09a 0, transparent 45%), linear-gradient(135deg, #58c069, #2f7d3d)"
          : "#141714",
      }}
    >
      {slide.imageUrl && (
        <>
          <img
            src={slide.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover"
          />
          <span
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(100deg, rgb(10 18 11 / 0.82) 0, rgb(10 18 11 / 0.35) 60%, rgb(10 18 11 / 0.05))",
            }}
          />
        </>
      )}
      <span
        className={cn(
          "absolute top-[1.23em] right-[1.23em] z-[2] inline-flex h-[2em] items-center gap-[0.4em] rounded-full px-[0.77em] text-[0.92em] font-semibold whitespace-nowrap",
          slide.badge === "sponsored"
            ? "bg-[#141714] text-[#fff]"
            : "bg-[rgb(255_255_255/0.22)] text-[#fff] backdrop-blur",
        )}
      >
        {slide.badge === "featured" && <Sparkles className="size-[1.08em]" />}
        {BADGE_LABEL[slide.badge]}
      </span>
      <span className="absolute inset-0 z-[1] flex flex-col justify-between p-[1.54em]">
        <span className="block pr-[7em]">
          <span className="line-clamp-2 block text-[2em] leading-[1.05] font-extrabold tracking-[-0.035em]">
            {slide.title || "Título do destaque"}
          </span>
          {slide.subtitle && (
            <span className="mt-[0.46em] line-clamp-2 block max-w-[17em] opacity-85">
              {slide.subtitle}
            </span>
          )}
        </span>
        {slide.ctaLabel && (
          <span
            className={cn(
              "inline-flex h-[2.92em] items-center gap-[0.46em] self-start rounded-full px-[1.23em] font-bold",
              promo ? "bg-[#141714] text-[#fff]" : "bg-[#fff] text-[#141714]",
            )}
          >
            {slide.ctaLabel}
            <ArrowRight className="size-[1.15em]" />
          </span>
        )}
      </span>
    </div>
  );
}

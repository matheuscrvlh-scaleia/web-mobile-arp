import type { Tone } from "@arp/contracts";
import { cn } from "@/shared/lib/cn";
import { iconFor } from "@/shared/lib/icons";
import { thumbnailProps } from "@/shared/lib/images";

/** Miniatura do evento como no app: a foto, ou o tom com o ícone. */
export function EventThumb({
  imageUrl,
  tone,
  icon,
  className,
  iconClassName = "size-6",
  sizes,
}: {
  imageUrl: string | null | undefined;
  tone: Tone | null | undefined;
  icon: string | null | undefined;
  className?: string;
  iconClassName?: string;
  /** Largura exibida: usa as miniaturas da API (sem ele, a original). */
  sizes?: string;
}) {
  if (imageUrl) {
    return (
      <span aria-hidden className={cn("block overflow-hidden", className)}>
        <img
          {...(sizes ? thumbnailProps(imageUrl, sizes) : { src: imageUrl })}
          alt=""
          loading="lazy"
          className="size-full object-cover"
        />
      </span>
    );
  }
  const Icon = iconFor(icon, iconFor("calendar-days"));
  return (
    <span
      aria-hidden
      className={cn(`tom-app-${tone ?? "green"}`, "grid place-items-center", className)}
    >
      <Icon className={iconClassName} />
    </span>
  );
}

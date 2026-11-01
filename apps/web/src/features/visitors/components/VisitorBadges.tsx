import type { AuthProvider, VisitorStatus } from "@arp/contracts";
import { Ban, BellOff, BellRing } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { initials } from "@/shared/lib/format";
import { thumbnailProps } from "@/shared/lib/images";
import { StatusBadge } from "@/shared/ui";

export const PROVIDER_LABEL: Record<AuthProvider, string> = {
  password: "E-mail e senha",
  google: "Google",
  apple: "Apple",
};

export function VisitorStatusBadge({ status }: { status: VisitorStatus }) {
  return status === "active" ? (
    <StatusBadge tone="success">Ativo</StatusBadge>
  ) : (
    <StatusBadge tone="danger" icon={Ban}>
      Bloqueado
    </StatusBadge>
  );
}

/** Aceitou receber comunicação (opt-in): só esses recebem push de ofertas. */
export function OptInBadge({ optIn }: { optIn: boolean }) {
  return optIn ? (
    <StatusBadge tone="brand" icon={BellRing}>
      Aceita ofertas
    </StatusBadge>
  ) : (
    <StatusBadge tone="neutral" icon={BellOff}>
      Sem ofertas
    </StatusBadge>
  );
}

/** Foto do visitante (do Google/Apple) ou as iniciais. */
export function VisitorAvatar({
  name,
  url,
  muted = false,
  size = "md",
}: {
  name: string;
  url: string | null;
  muted?: boolean;
  size?: "md" | "xl";
}) {
  const box = size === "xl" ? "size-20 text-2xl" : "size-10 text-sm";
  if (url) {
    return (
      <img
        {...thumbnailProps(url, size === "xl" ? "80px" : "40px")}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn("shrink-0 rounded-full object-cover", box, muted && "grayscale")}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold",
        box,
        muted ? "bg-neutral-200 text-neutral-500" : "bg-marca/20 text-green-800",
      )}
    >
      {initials(name)}
    </span>
  );
}

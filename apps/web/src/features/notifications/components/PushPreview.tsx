import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useNow } from "@/shared/hooks";
import { cn } from "@/shared/lib/cn";
import { formatTime, formatToday } from "@/shared/lib/format";
import { PhoneFrame, Segmented } from "@/shared/ui";

type Platform = "ios" | "android";

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "ios", label: "iPhone" },
  { value: "android", label: "Android" },
];

/**
 * Prévia do push na tela bloqueada, no estilo de cada sistema. O texto é
 * cortado como o celular corta (título em 1 linha, mensagem em até 4).
 */
export function PushPreview({ title, body }: { title: string; body: string }) {
  const [platform, setPlatform] = useState<Platform>("ios");
  const now = useNow();
  const t = title.trim();
  const b = body.trim();
  return (
    <div className="flex flex-col items-center gap-4">
      <Segmented
        label="Sistema da prévia"
        size="sm"
        options={PLATFORMS}
        value={platform}
        onChange={setPlatform}
      />
      <p className="sr-only" aria-live="polite">
        Prévia da notificação: {t || "sem título"}. {b || "sem mensagem"}.
      </p>
      <PhoneFrame screen="dark">
        <div className="flex h-full flex-col px-3">
          <div className="pt-6 pb-8 text-center">
            <p className="text-sm font-medium opacity-80 first-letter:uppercase">
              {formatToday(new Date(now))}
            </p>
            <p
              className={cn(
                "leading-none font-semibold tracking-tight tabular-nums",
                platform === "ios" ? "mt-1 text-7xl" : "mt-2 text-6xl font-normal",
              )}
            >
              {formatTime(new Date(now))}
            </p>
          </div>
          {platform === "ios" ? <IosCard title={t} body={b} /> : <AndroidCard title={t} body={b} />}
        </div>
      </PhoneFrame>
    </div>
  );
}

function AppIcon({ className }: { className?: string }) {
  return (
    <img
      src="/brand/logo.png"
      alt=""
      decoding="async"
      className={cn("shrink-0 object-cover", className)}
    />
  );
}

function Placeholder({ text }: { text: string }) {
  return <span className="opacity-50">{text}</span>;
}

function IosCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex gap-2.5 rounded-[1.4rem] bg-[rgb(245_245_245/0.82)] p-3 text-[#141714] shadow-lg backdrop-blur-xl">
      <AppIcon className="mt-0.5 size-9 rounded-[0.6rem]" />
      <div className="min-w-0 flex-1 text-[13px] leading-snug">
        <div className="flex items-baseline justify-between gap-2">
          <b className="truncate font-semibold">{title || <Placeholder text="Título" />}</b>
          <span className="shrink-0 text-[11px] text-[#6b6b6b]">agora</span>
        </div>
        <p className="line-clamp-4 break-words">{body || <Placeholder text="Mensagem" />}</p>
      </div>
    </div>
  );
}

function AndroidCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[1.6rem] bg-[rgb(32_36_33/0.92)] p-4 text-[#fff] shadow-lg backdrop-blur-xl">
      <div className="flex items-center gap-2 text-[11px] text-[rgb(255_255_255/0.7)]">
        <AppIcon className="size-5 rounded-full" />
        <span>ARP • agora</span>
        <ChevronDown className="ml-auto size-4" aria-hidden />
      </div>
      <div className="mt-2 text-[13px] leading-snug">
        <b className="block truncate font-semibold">{title || <Placeholder text="Título" />}</b>
        <p className="line-clamp-4 break-words text-[rgb(255_255_255/0.82)]">
          {body || <Placeholder text="Mensagem" />}
        </p>
      </div>
    </div>
  );
}

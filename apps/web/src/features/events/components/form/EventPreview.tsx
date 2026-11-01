import type { Tone } from "@arp/contracts";
import { Award, CalendarDays, Clock, MapPin, Repeat } from "lucide-react";
import type { ReactNode } from "react";
import { describeDays, describeTime, type WhenInput } from "../../lib/when";
import { EventThumb } from "../EventThumb";

/** Prévia do detalhe do evento no app (`.ev-hero` + regras "Quando / Horário / Onde"). */
export function EventPreview({
  title,
  categoryName,
  description,
  imageUrl,
  tone,
  icon,
  where,
  awardsSeal,
  when,
}: {
  title: string;
  categoryName: string | undefined;
  description: string;
  imageUrl: string | null | undefined;
  tone: Tone | null | undefined;
  icon: string | null | undefined;
  where: string;
  awardsSeal: boolean;
  when: WhenInput;
}) {
  const time = describeTime(when.startTime, when.endTime);
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-[1.75rem] bg-[#fff] text-[#141714] shadow-xl"
    >
      <div className="relative aspect-[16/11]">
        <EventThumb
          imageUrl={imageUrl}
          tone={tone}
          icon={icon}
          className="absolute inset-0"
          iconClassName="size-16 opacity-90"
        />
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
          {categoryName && <Pill>{categoryName}</Pill>}
          {when.recurrence === "range" && when.isLongRunning && (
            <Pill>
              <Repeat className="size-3" />
              Todo o período
            </Pill>
          )}
          {awardsSeal && (
            <span className="inline-flex h-6 items-center gap-1 rounded-full bg-[#dff3e2] px-2.5 text-[11px] font-semibold text-[#1f5c29]">
              <Award className="size-3" />
              Vale selo
            </span>
          )}
        </div>
      </div>
      <div className="p-4">
        <p className="text-xl leading-tight font-extrabold tracking-tight">
          {title || "Nome do evento"}
        </p>
        {description && (
          <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-[#6b6f6b]">
            {description}
          </p>
        )}
        <div className="mt-3 flex flex-col gap-2">
          <Rule
            icon={<CalendarDays className="size-4" />}
            label="Quando"
            value={describeDays(when)}
          />
          {time && <Rule icon={<Clock className="size-4" />} label="Horário" value={time} />}
          <Rule icon={<MapPin className="size-4" />} label="Onde" value={where || "Local"} />
        </div>
      </div>
    </div>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-full bg-[rgb(255_255_255/0.22)] px-2.5 text-[11px] font-semibold text-[#fff] backdrop-blur">
      {children}
    </span>
  );
}

function Rule({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#f4f2ef] p-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#fff]">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[10px] text-[#8a8f8a]">{label}</span>
        <span className="block truncate text-xs font-semibold">{value}</span>
      </span>
    </div>
  );
}

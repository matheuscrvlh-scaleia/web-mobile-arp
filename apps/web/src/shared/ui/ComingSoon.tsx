import { Hourglass, type LucideIcon } from "lucide-react";
import { PageHeader } from "./PageHeader";

/** Tela ainda em construção (mantém rota, menu e título no lugar). */
export function ComingSoon({
  title,
  description,
  icon: Icon = Hourglass,
  details,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  /** O que a tela vai ter. */
  details: string[];
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="vidro relative isolate overflow-hidden rounded-[2rem] px-6 py-12 text-center md:py-16">
        <div
          aria-hidden
          className="absolute -top-24 left-1/2 -z-10 h-56 w-2/3 -translate-x-1/2 animate-pulse rounded-full bg-marca/25 blur-3xl [animation-duration:4s] motion-reduce:animate-none"
        />
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-neutral-900 text-white shadow-[0_0_0_8px_rgb(0_0_0/0.05)]">
          <Icon className="size-6" aria-hidden />
        </span>
        <p className="mt-5 text-lg font-semibold">Em construção</p>
        <ul className="mx-auto mt-3 flex max-w-md flex-col gap-1 text-sm text-neutral-500">
          {details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </div>
    </>
  );
}

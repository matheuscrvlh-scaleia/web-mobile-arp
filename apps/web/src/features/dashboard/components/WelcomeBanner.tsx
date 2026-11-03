import type { ReactNode } from "react";

/**
 * Banner de boas-vindas: fachada do Espaço ARP (letreiro à direita, à
 * mostra) levemente desfocada, sob um degradê preto à esquerda, onde fica o
 * texto. Escuro nos dois temas (por isso as cores literais, que o tema
 * escuro não inverte).
 */
export function WelcomeBanner({
  eyebrow,
  name,
  children,
}: {
  eyebrow: ReactNode;
  name: string;
  children: ReactNode;
}) {
  return (
    <header className="relative isolate overflow-hidden rounded-[2rem] px-6 py-10 text-[#fff] shadow-[0_24px_50px_-28px_rgb(0_0_0/0.55)] md:px-10 md:py-12">
      <img
        src="/brand/banner-dashboard.webp"
        alt=""
        fetchPriority="high"
        className="absolute inset-0 -z-30 size-full scale-105 object-cover object-[center_calc(36%_-_10px)] blur-[2px]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-20 bg-[linear-gradient(100deg,#0a0a0a_0%,rgb(10_10_10/0.92)_30%,rgb(10_10_10/0.55)_55%,rgb(10_10_10/0.12)_100%)]"
      />
      <p className="text-xs font-semibold tracking-[0.2em] text-[#8fd99b] uppercase">{eyebrow}</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">Olá, {name}</h1>
      <p className="mt-3 max-w-xl text-sm text-[rgb(255_255_255/0.82)] md:text-base">{children}</p>
    </header>
  );
}

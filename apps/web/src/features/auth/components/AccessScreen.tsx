import type { ReactNode } from "react";
import { useDocumentTitle } from "@/shared/hooks";

/** Moldura das telas fora do app (entrar, trocar senha): formulário à esquerda, foto à direita. */
export function AccessScreen({
  title,
  subtitle,
  documentTitle,
  children,
}: {
  title: string;
  subtitle: ReactNode;
  documentTitle: string;
  children: ReactNode;
}) {
  useDocumentTitle(documentTitle);
  return (
    <main className="grid min-h-dvh bg-white md:grid-cols-[516px_1fr] xl:grid-cols-[580px_1fr]">
      <section className="flex flex-col justify-between gap-12 p-8 md:p-12">
        <span className="flex items-center gap-3">
          <img src="/brand/logo.png" alt="" width={40} height={40} className="size-10 rounded-xl" />
          <span className="leading-tight">
            <span className="block font-semibold text-neutral-900">ARP</span>
            <span className="block text-xs text-neutral-500">Gestor do app</span>
          </span>
        </span>

        <div className="mx-auto w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 mb-8 text-sm text-neutral-500">{subtitle}</p>
          {children}
        </div>

        <p className="text-xs text-neutral-400">
          Acesso restrito à equipe da ARP e aos lojistas parceiros. Problemas para entrar? Fale com
          o administrador.
        </p>
      </section>

      <section className="relative hidden md:block">
        <img
          src="/brand/espaco-arp-evento.webp"
          alt="Apresentação de dança no Espaço ARP, em Nova Friburgo"
          width={860}
          height={557}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[rgb(0_0_0/0.7)] via-[rgb(0_0_0/0.1)] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-[#fff]">
          <img
            src="/brand/trevo.png"
            alt=""
            width={40}
            height={40}
            decoding="async"
            className="mb-5 size-10"
          />
          <p className="text-4xl font-semibold tracking-tight">Onde tudo acontece.</p>
          <p className="mt-2 text-sm text-[rgb(255_255_255/0.8)]">Espaço ARP · Nova Friburgo, RJ</p>
        </div>
      </section>
    </main>
  );
}

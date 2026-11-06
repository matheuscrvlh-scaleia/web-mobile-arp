import { useQueryClient } from "@tanstack/react-query";
import { Menu, X } from "lucide-react";
import { Suspense, useEffect, useId, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigation } from "react-router";
import { usePending } from "@/features/dashboard/api";
import { pendingTotal } from "@/features/dashboard/lib/pending";
import { useCurrentUser } from "@/shared/auth";
import { cn } from "@/shared/lib/cn";
import { OfflineBanner, PageSkeleton, toast } from "@/shared/ui";
import { installDraftCapture, restoreDraftFor } from "../draft-recovery";
import { homePathFor, navigationFor } from "../navigation";
import { Brand } from "./Brand";
import { SidebarNav } from "./SidebarNav";
import { TopBar } from "./TopBar";
import { UserPanel } from "./UserPanel";

// Sessão caiu com formulário sujo ou salvando: guarda o rascunho (volta depois do login).
installDraftCapture();

/** De volta à tela onde a sessão caiu: devolve o que estava digitado. */
function useDraftRestore() {
  const queryClient = useQueryClient();
  // Quem diz se há gravação em andamento é o cliente de queries atual.
  useEffect(() => installDraftCapture(() => queryClient.isMutating() > 0), [queryClient]);
  const { pathname, search } = useLocation();
  useEffect(() => {
    const ctrl = new AbortController();
    void restoreDraftFor(`${pathname}${search}`, ctrl.signal).then((restored) => {
      if (restored) {
        toast.info(
          "Recuperamos o que você tinha digitado antes de a sessão expirar. Confira e salve.",
        );
      }
    });
    return () => ctrl.abort();
  }, [pathname, search]);
}

/**
 * Moldura das telas logadas: aurora atrás, menu de vidro flutuante à
 * esquerda (gaveta no celular) e a barra do topo. O menu é um só: no
 * computador fica sempre aberto; no celular abre pelo botão com a marca.
 */
export function AppShell() {
  const user = useCurrentUser();
  const sections = useMemo(() => navigationFor(user), [user]);
  const home = homePathFor(user) ?? "/";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerId = useId();
  const navigation = useNavigation();
  const { pathname } = useLocation();
  useDraftRestore();
  const pending = pendingTotal(usePending().data?.data ?? []);

  return (
    <div className="min-h-dvh p-3 md:p-5">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[80] focus:rounded-full focus:bg-neutral-900 focus:px-4 focus:py-2 focus:text-white"
      >
        Pular para o conteúdo
      </a>
      {navigation.state === "loading" && (
        <div
          role="progressbar"
          aria-label="Carregando a tela"
          className="progresso-navegacao fixed inset-x-0 top-0 z-[90] h-0.5"
        />
      )}
      <OfflineBanner />
      <div aria-hidden className="aurora">
        <i />
        <i />
        <i />
      </div>
      <div className="mx-auto flex max-w-[1680px] flex-col gap-5 md:flex-row">
        <aside className="vidro flex flex-col rounded-[1.75rem] md:sticky md:top-5 md:h-[calc(100dvh-2.5rem)] md:w-[17rem] md:shrink-0 md:rounded-[2rem] md:p-5">
          <Link to={home} aria-label="Início" className="mb-8 hidden md:block">
            <Brand />
          </Link>
          <button
            type="button"
            onClick={() => setDrawerOpen((o) => !o)}
            aria-expanded={drawerOpen}
            aria-controls={drawerId}
            className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left md:hidden"
          >
            <Brand />
            <span className="relative grid size-10 place-items-center rounded-full bg-neutral-900 text-white">
              {/* Pendências também no ☰ (o sino fica dentro da gaveta). */}
              {!drawerOpen && pending > 0 && (
                <span
                  aria-hidden
                  className="absolute -top-1 -right-1 min-w-5 rounded-full bg-amber-400 px-1 text-center text-[10px] leading-5 font-semibold text-amber-950 tabular-nums"
                >
                  {pending > 99 ? "99+" : pending}
                </span>
              )}
              {drawerOpen ? (
                <X className="size-4" aria-hidden />
              ) : (
                <Menu className="size-4" aria-hidden />
              )}
              <span className="sr-only">
                {drawerOpen ? "Fechar menu" : "Abrir menu"}
                {!drawerOpen && pending > 0 ? ` (${pending} pendências)` : ""}
              </span>
            </span>
          </button>
          {/* Celular: a lista rola dentro da gaveta e o pé (tema, usuário) fica
              fixo embaixo, opaco, sem cobrir itens. */}
          <div
            id={drawerId}
            className={cn(
              drawerOpen ? "flex" : "hidden",
              "max-h-[calc(100dvh-7rem)] min-h-0 flex-col gap-4 overflow-hidden px-4 pb-4 md:flex md:max-h-none md:flex-1 md:overflow-visible md:p-0",
            )}
          >
            {/* Esmaece o pé da lista: mostra que há mais itens rolando (o pb-8 deixa
                o último item sair por inteiro do esmaecido no fim da rolagem). */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-8 [mask-image:linear-gradient(to_bottom,black_calc(100%-2rem),transparent)]">
              {sections.length > 0 ? (
                <SidebarNav sections={sections} onNavigate={() => setDrawerOpen(false)} />
              ) : (
                <p className="px-3 text-sm text-neutral-500">
                  Nenhuma tela liberada para você ainda.
                </p>
              )}
            </div>
            <div className="shrink-0 border-t border-neutral-200/70 pt-4 md:border-0 md:pt-0">
              <UserPanel />
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <TopBar sections={sections} />
          {/* min-w-0 + overflow-x-clip: filho largo (tabela, código) rola dentro
              do próprio quadro, nunca a página inteira no celular. */}
          <main
            id="conteudo"
            tabIndex={-1}
            className="min-w-0 overflow-x-clip pb-6 outline-none [overflow-clip-margin:1.25rem]"
          >
            {/* key: trocar de tela reinicia o limite de Suspense (sem esqueleto preso). */}
            <Suspense key={pathname} fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  );
}

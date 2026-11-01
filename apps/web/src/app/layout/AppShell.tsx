import { Menu, X } from "lucide-react";
import { Suspense, useId, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigation } from "react-router";
import { useCurrentUser } from "@/shared/auth";
import { cn } from "@/shared/lib/cn";
import { PageSkeleton } from "@/shared/ui";
import { homePathFor, navigationFor } from "../navigation";
import { Brand } from "./Brand";
import { SidebarNav } from "./SidebarNav";
import { TopBar } from "./TopBar";
import { UserPanel } from "./UserPanel";

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
            <span className="grid size-10 place-items-center rounded-full bg-neutral-900 text-white">
              {drawerOpen ? (
                <X className="size-4" aria-hidden />
              ) : (
                <Menu className="size-4" aria-hidden />
              )}
              <span className="sr-only">{drawerOpen ? "Fechar menu" : "Abrir menu"}</span>
            </span>
          </button>
          <div
            id={drawerId}
            className={cn(
              drawerOpen ? "flex" : "hidden",
              "max-h-[75dvh] min-h-0 flex-col gap-4 overflow-y-auto px-4 pb-4 md:flex md:max-h-none md:flex-1 md:overflow-visible md:p-0",
            )}
          >
            <div className="min-h-0 flex-1 md:overflow-y-auto">
              {sections.length > 0 ? (
                <SidebarNav sections={sections} onNavigate={() => setDrawerOpen(false)} />
              ) : (
                <p className="px-3 text-sm text-neutral-500">
                  Nenhuma tela liberada para você ainda.
                </p>
              )}
            </div>
            <UserPanel />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <TopBar sections={sections} />
          <main id="conteudo" tabIndex={-1} className="min-w-0 pb-6 outline-none">
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

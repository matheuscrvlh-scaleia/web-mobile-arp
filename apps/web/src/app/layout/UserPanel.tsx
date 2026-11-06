import { Bell, ChevronRight, CircleCheck, LogOut, Moon, Store, Sun } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { usePending } from "@/features/dashboard/api";
import { pendingTotal, pendingView } from "@/features/dashboard/lib/pending";
import { useAuth, useCurrentUser } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { useTheme } from "@/shared/theme/theme";
import { Avatar } from "@/shared/ui";

/** Claro/Escuro. A escolha fica no navegador; o index.html a aplica antes da pintura. */
export function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Modo escuro"
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-neutral-700 shadow-sm ring-1 ring-black/5 transition hover:text-neutral-900"
    >
      {dark ? (
        <Moon className="size-4 shrink-0 text-violet-700" aria-hidden />
      ) : (
        <Sun className="size-4 shrink-0 text-amber-500" aria-hidden />
      )}
      <span className="flex-1 text-left">{dark ? "Escuro" : "Claro"}</span>
      <span
        aria-hidden
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${dark ? "bg-neutral-900" : "bg-neutral-200"}`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${dark ? "left-[1.125rem]" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}

/**
 * O sino: as pendências da pessoa (as mesmas do Dashboard), com o total.
 * Quem vê um sino espera "avisos para mim", não a tela de enviar push.
 */
function PendingBell() {
  const pending = usePending();
  const items = pending.data?.data ?? [];
  const total = pendingTotal(items);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    // Sem "relative" aqui: o painel se ancora à faixa inteira (tema + sino), à
    // esquerda, para não sair da tela pela borda do menu (R2G-03).
    <div ref={box}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={total > 0 ? `Pendências: ${total}` : "Pendências: nada esperando"}
        title="Pendências"
        onClick={() => setOpen((o) => !o)}
        className="relative grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl bg-white text-neutral-500 shadow-sm ring-1 ring-black/5 transition hover:text-neutral-900"
      >
        <Bell className="size-4" aria-hidden />
        {total > 0 && (
          <span
            aria-hidden
            className="absolute -top-1.5 -right-1.5 min-w-5 rounded-full bg-amber-400 px-1 text-center text-[10px] leading-5 font-semibold text-amber-950 tabular-nums"
          >
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>
      {open && (
        <div
          id={panelId}
          className="painel-modal absolute bottom-full left-0 z-50 mb-2 w-72 max-w-[calc(100vw-2rem)] rounded-3xl p-2"
        >
          <p className="px-2 pt-1 pb-2 text-xs font-medium tracking-wider text-neutral-400 uppercase">
            Pendências
          </p>
          {items.length === 0 ? (
            <p className="flex items-center gap-2 px-2 pb-2 text-sm text-green-800">
              <CircleCheck className="size-4" aria-hidden />
              Tudo em dia ✓
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {items.map((item) => {
                const v = pendingView(item);
                const Icon = v.icon;
                return (
                  <li key={item.kind}>
                    <Link
                      to={v.to}
                      onClick={() => setOpen(false)}
                      className="flex min-h-11 items-center gap-2 rounded-2xl px-2 py-1.5 text-sm text-neutral-700 hover:bg-white/80 hover:text-neutral-900"
                    >
                      <Icon
                        className={`size-4 shrink-0 ${v.urgent ? "text-amber-700" : "text-neutral-500"}`}
                        aria-hidden
                      />
                      <span className="flex-1">{v.title}</span>
                      <ChevronRight className="size-4 shrink-0 text-neutral-400" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Pé do menu: tema, pendências, cartão do usuário (Minha conta) e sair. */
export function UserPanel() {
  const user = useCurrentUser();
  const { signOut } = useAuth();
  const [leaving, setLeaving] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <div className="relative flex items-center gap-2 rounded-2xl bg-neutral-100 p-1.5">
        <ThemeToggle />
        <PendingBell />
      </div>
      <div className="flex items-center gap-1">
        {/* Minha conta: dados de acesso e trocar a própria senha. */}
        <Link
          to={PATHS.account}
          title="Minha conta"
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 transition hover:bg-neutral-100"
        >
          <Avatar name={user.name} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{user.name}</span>
            <span className="flex items-center gap-1 truncate text-xs text-neutral-500">
              {user.store ? (
                <>
                  <Store className="size-3 shrink-0" aria-hidden />
                  <span className="truncate">{user.store.name}</span>
                </>
              ) : (
                user.role.name
              )}
            </span>
            <span className="block text-[11px] text-neutral-400">Minha conta</span>
          </span>
        </Link>
        <button
          type="button"
          aria-label="Sair"
          title="Sair"
          disabled={leaving}
          onClick={() => {
            setLeaving(true);
            void signOut();
          }}
          className="grid size-9 cursor-pointer place-items-center rounded-xl text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50"
        >
          <LogOut className="size-4" aria-hidden />
        </button>
      </div>
      <p className="text-center text-xs text-neutral-500">
        Desenvolvido por{" "}
        <a
          href="https://scaleia.ai/"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-gradient-to-r from-[#8b5cf6] to-[#4f46e5] bg-clip-text font-semibold text-transparent underline-offset-2 hover:underline hover:decoration-[#6d5ce7]"
        >
          Scale
        </a>
      </p>
    </div>
  );
}

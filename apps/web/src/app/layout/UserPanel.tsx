import { KeyRound, LogOut, Moon, Store, Sun } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
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

/** Pé do menu: tema, cartão do usuário (com a loja, se lojista) e sair. */
export function UserPanel() {
  const user = useCurrentUser();
  const { signOut } = useAuth();
  const [leaving, setLeaving] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-2xl bg-neutral-100 p-1.5">
        <ThemeToggle />
      </div>
      <div className="flex items-center gap-3 px-1">
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
        </span>
        <Link
          to={PATHS.changePassword}
          aria-label="Trocar senha"
          title="Trocar senha"
          className="grid size-9 place-items-center rounded-xl text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
        >
          <KeyRound className="size-4" aria-hidden />
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

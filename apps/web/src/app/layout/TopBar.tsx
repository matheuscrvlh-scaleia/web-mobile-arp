import { CalendarDays, CornerDownLeft, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { cn } from "@/shared/lib/cn";
import { formatToday } from "@/shared/lib/format";
import { normalize } from "@/shared/lib/text";
import { activeNavItem, type NavSection } from "../navigation";
import { prefetchRoute } from "../prefetch";

/** Barra do topo: onde estou (Seção / Tela), a data e a busca de telas (Ctrl+K). */
export function TopBar({ sections }: { sections: NavSection[] }) {
  const { pathname, search } = useLocation();
  const here = activeNavItem(sections, pathname, search);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="flex min-h-11 items-center gap-2 text-sm text-neutral-500">
        {here && (
          <>
            <span>{here.section.title}</span>
            <span aria-hidden>/</span>
            <span className="font-medium text-neutral-900">{here.item.label}</span>
          </>
        )}
      </p>
      <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
        <span className="vidro hidden items-center gap-2 rounded-full py-1.5 pr-4 pl-1.5 text-sm text-neutral-700 lg:flex">
          <span className="grid size-8 place-items-center rounded-full bg-neutral-900 text-white">
            <CalendarDays className="size-4" aria-hidden />
          </span>
          {formatToday()}
        </span>
        <ScreenSearch sections={sections} />
      </div>
    </div>
  );
}

/** Busca rápida de telas: Ctrl+K foca; setas escolhem; Enter abre; Esc sai. */
function ScreenSearch({ sections }: { sections: NavSection[] }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  const results = useMemo(() => {
    const all = sections.flatMap((s) => s.items.map((it) => ({ ...it, section: s.title })));
    const t = normalize(term.trim());
    if (!t) return all.slice(0, 8);
    return all.filter((i) => normalize(`${i.section} ${i.label}`).includes(t)).slice(0, 8);
  }, [term, sections]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // A tela em destaque na lista já começa a baixar.
  const highlighted = open ? results[index]?.to : undefined;
  useEffect(() => {
    if (highlighted) prefetchRoute(highlighted);
  }, [highlighted]);

  const go = (to: string) => {
    setTerm("");
    setOpen(false);
    input.current?.blur();
    navigate(to);
  };

  const activeId = open && results[index] ? `${listId}-${index}` : undefined;

  return (
    <div className="relative w-full sm:w-80">
      <label className="vidro flex items-center gap-2 rounded-full py-1.5 pr-3 pl-1.5 text-sm">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-neutral-900 text-white">
          <Search className="size-4" aria-hidden />
        </span>
        <span className="sr-only">Buscar tela</span>
        <input
          ref={input}
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setIndex(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setIndex((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              const r = results[index];
              if (r) {
                e.preventDefault();
                go(r.to);
              }
            } else if (e.key === "Escape") {
              setOpen(false);
              input.current?.blur();
            }
          }}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          placeholder="Buscar tela…"
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-neutral-400"
        />
        <kbd className="hidden rounded-md border border-neutral-200 px-1.5 text-[10px] text-neutral-400 sm:block">
          Ctrl K
        </kbd>
      </label>
      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label="Telas"
          className="vidro absolute top-full right-0 z-40 mt-2 w-full overflow-hidden rounded-3xl p-1.5"
        >
          {results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-neutral-500">Nenhuma tela encontrada.</p>
          ) : (
            results.map((r, i) => {
              const Icon = r.icon;
              const on = i === index;
              return (
                <div
                  key={r.to}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={on}
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go(r.to)}
                  onKeyDown={() => undefined}
                  onMouseEnter={() => setIndex(i)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm",
                    on ? "bg-neutral-900 text-white" : "text-neutral-700",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="flex-1 truncate">
                    {r.label} <span className="opacity-60">· {r.section}</span>
                  </span>
                  {on && <CornerDownLeft className="size-3.5 opacity-70" aria-hidden />}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

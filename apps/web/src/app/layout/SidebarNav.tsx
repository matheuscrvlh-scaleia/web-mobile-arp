import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { cn } from "@/shared/lib/cn";
import { activeNavItem, type NavSection } from "../navigation";
import { prefetchRoute } from "../prefetch";

const STORAGE_KEY = "menu-recolhido";

function readCollapsed(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeCollapsed(list: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Sem armazenamento: vale até recarregar.
  }
}

/**
 * Menu com seções recolhíveis (a escolha fica salva). Ao chegar numa tela
 * de uma seção recolhida (pela busca, um link), ela se abre sozinha.
 */
export function SidebarNav({
  sections,
  onNavigate,
}: {
  sections: NavSection[];
  /** Fecha a gaveta no celular ao escolher uma tela. */
  onNavigate?: () => void;
}) {
  const { pathname, search } = useLocation();
  const active = activeNavItem(sections, pathname, search);
  const activeSection = active?.section.title;
  const [collapsed, setCollapsed] = useState<string[]>(readCollapsed);

  useEffect(() => {
    if (!activeSection) return;
    setCollapsed((cur) => {
      if (!cur.includes(activeSection)) return cur;
      const next = cur.filter((t) => t !== activeSection);
      writeCollapsed(next);
      return next;
    });
  }, [activeSection]);

  const toggle = (title: string) => {
    const next = collapsed.includes(title)
      ? collapsed.filter((t) => t !== title)
      : [...collapsed, title];
    setCollapsed(next);
    writeCollapsed(next);
  };

  return (
    <nav aria-label="Menu principal" className="flex flex-col gap-4 text-sm">
      {sections.map((section) => {
        const open = !collapsed.includes(section.title);
        const id = `menu-${section.title.toLowerCase().replace(/\s+/g, "-")}`;
        return (
          <div key={section.title}>
            <button
              type="button"
              onClick={() => toggle(section.title)}
              aria-expanded={open}
              aria-controls={id}
              className="mb-1 flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-1.5 text-xs font-medium tracking-wider text-neutral-400 uppercase transition hover:text-neutral-700"
            >
              {section.title}
              <ChevronDown
                className={cn("size-4 transition-transform", !open && "-rotate-90")}
                aria-hidden
              />
            </button>
            {open && (
              <ul id={id} className="flex flex-col gap-1">
                {section.items.map((it) => {
                  const Icon = it.icon;
                  const current = active?.item === it;
                  return (
                    <li key={it.to}>
                      <Link
                        to={it.to}
                        onClick={onNavigate}
                        onMouseEnter={() => prefetchRoute(it.to)}
                        onFocus={() => prefetchRoute(it.to)}
                        aria-current={current ? "page" : undefined}
                        className="group flex items-center gap-3 rounded-full px-3 py-2.5 text-neutral-600 transition hover:bg-white/70 hover:text-neutral-900 aria-[current=page]:bg-neutral-900 aria-[current=page]:font-medium aria-[current=page]:text-white aria-[current=page]:shadow-lg aria-[current=page]:shadow-black/10"
                      >
                        <Icon
                          className="size-[18px] shrink-0 opacity-80 group-aria-[current=page]:opacity-100"
                          aria-hidden
                        />
                        <span className="truncate">{it.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

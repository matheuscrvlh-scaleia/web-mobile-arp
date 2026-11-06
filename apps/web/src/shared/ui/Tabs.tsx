import type { LucideIcon } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef } from "react";
import { NavLink } from "react-router";
import { cn } from "@/shared/lib/cn";

// No celular as opções quebram linha em vez de rolar escondidas para o lado.
const BAR =
  "vidro inline-flex max-w-full gap-1 overflow-x-auto rounded-full p-1 max-sm:flex-wrap max-sm:rounded-3xl";
const ITEM =
  "inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm whitespace-nowrap text-neutral-500 transition hover:text-neutral-900";
const ACTIVE = "bg-neutral-900 font-medium text-white hover:text-white";

export interface TabItem<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Número ao lado do rótulo (ex.: quantidade). */
  count?: number;
}

/** Setas, Home e End andam entre os itens (padrão ARIA de abas e de rádios). */
function useRovingKeys<T extends string>(items: TabItem<T>[], onChange: (v: T) => void) {
  const refs = useRef(new Map<T, HTMLButtonElement>());
  const onKeyDown = (e: KeyboardEvent, index: number) => {
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (index + 1) % items.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      next = (index - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const item = items[next];
    if (!item) return;
    onChange(item.value);
    refs.current.get(item.value)?.focus();
  };
  const ref = (value: T) => (el: HTMLButtonElement | null) => {
    if (el) refs.current.set(value, el);
    else refs.current.delete(value);
  };
  return { onKeyDown, ref };
}

function ItemContent({ item, active }: { item: TabItem<string>; active: boolean }) {
  const Icon = item.icon;
  return (
    <>
      {Icon && <Icon className="size-4" aria-hidden />}
      {item.label}
      {item.count !== undefined && (
        <span
          className={cn(
            "rounded-full px-1.5 text-[11px] tabular-nums",
            active ? "bg-[rgb(255_255_255/0.18)]" : "bg-neutral-900/[0.07]",
          )}
        >
          {item.count}
        </span>
      )}
    </>
  );
}

/**
 * Abas em pílula (a ativa fica preta). Use com <TabPanel> do mesmo `idBase`
 * para ligar aba e conteúdo para leitores de tela.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  idBase,
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Nome do grupo de abas para leitores de tela. */
  label: string;
  idBase: string;
  className?: string;
}) {
  const { onKeyDown, ref } = useRovingKeys(items, onChange);
  // No celular a barra rola de lado: a aba ativa sempre fica à vista (só a barra rola, não a página).
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bar = barRef.current;
    const el = bar?.querySelector<HTMLElement>(`[id="${idBase}-tab-${value}"]`);
    if (!bar || !el || bar.scrollWidth <= bar.clientWidth) return;
    const b = bar.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.left < b.left) bar.scrollLeft += r.left - b.left - 8;
    else if (r.right > b.right) bar.scrollLeft += r.right - b.right + 8;
  }, [idBase, value]);
  return (
    <div ref={barRef} role="tablist" aria-label={label} className={cn(BAR, className)}>
      {items.map((item, i) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            ref={ref(item.value)}
            type="button"
            role="tab"
            id={`${idBase}-tab-${item.value}`}
            aria-selected={active}
            aria-controls={`${idBase}-panel-${item.value}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(ITEM, active && ACTIVE)}
          >
            <ItemContent item={item} active={active} />
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({
  idBase,
  value,
  children,
  className,
}: {
  idBase: string;
  value: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="tabpanel"
      id={`${idBase}-panel-${value}`}
      aria-labelledby={`${idBase}-tab-${value}`}
      className={className}
    >
      {children}
    </div>
  );
}

/**
 * Escolha única em pílula (ex.: período 7/30/90 dias). São rádios nativos
 * escondidos: setas, Tab e leitores de tela funcionam como em qualquer
 * grupo de opções.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
  className,
}: {
  options: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const name = useId();
  return (
    <fieldset className={cn(BAR, "min-w-0", className)}>
      <legend className="sr-only">{label}</legend>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <label
            key={o.value}
            className={cn(
              ITEM,
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-neutral-900/50",
              size === "sm" && "px-3 py-1.5 text-xs",
              active && ACTIVE,
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={active}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            <ItemContent item={o} active={active} />
          </label>
        );
      })}
    </fieldset>
  );
}

/** Abas que são links (telas irmãs, ex.: Usuários | Cargos). */
export function NavTabs({
  items,
  label = "Seções",
  className,
}: {
  items: { to: string; label: string; icon?: LucideIcon; end?: boolean }[];
  label?: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn(BAR, "mb-6", className)}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => cn(ITEM, isActive && ACTIVE)}
          >
            {Icon && <Icon className="size-4" aria-hidden />}
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

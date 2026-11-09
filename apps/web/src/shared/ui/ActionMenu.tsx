import { type LucideIcon, MoreHorizontal } from "lucide-react";
import {
  Fragment,
  type KeyboardEvent,
  type RefObject,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/shared/lib/cn";
import { buttonClasses } from "./Button";
import { floatingHost, placeNear } from "./floating";

// Menu "⋯" das ações de um item (lista e cabeçalho do detalhe): Duplicar,
// Arquivar, Excluir… O vermelho (danger) vai sempre por último, depois de
// um separador. Item desabilitado mostra o motivo em texto (não só dica).

export interface ActionMenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  /** Vermelho, separado no fim (Excluir). */
  danger?: boolean;
  disabled?: boolean;
  /** Por que está desabilitado, em texto pequeno sob o rótulo ("Já deu 37 selos: arquive"). */
  hint?: string;
}

/** `false`/`null` são ignorados: dá para montar a lista com `cond && {...}`. */
export type ActionMenuItems = Array<ActionMenuItem | false | null | undefined>;

const MENU_WIDTH = 256;
const MARGIN = 8;

const stop = (e: SyntheticEvent) => e.stopPropagation();

export function ActionMenu({
  items,
  label,
  ariaLabel = "Mais ações",
  align = "end",
  size = "md",
  className,
}: {
  items: ActionMenuItems;
  /** Com texto (cabeçalho do detalhe): `label="Mais"`. Sem: só o ícone "⋯". */
  label?: string;
  /** Nome do botão para leitores de tela (ex.: "Mais ações de Black Friday"). */
  ariaLabel?: string;
  /** Lado em que o menu se alinha ao botão. */
  align?: "start" | "end";
  /** "sm" para linhas densas (32px no desktop; 44px no toque sempre). */
  size?: "sm" | "md";
  className?: string;
}) {
  const list = items.filter((i): i is ActionMenuItem => Boolean(i));
  // Os perigosos sempre por último, na ordem em que vieram.
  const ordered = [...list.filter((i) => !i.danger), ...list.filter((i) => i.danger)];
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const close = useCallback((focusTrigger: boolean) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }, []);

  if (ordered.length === 0) return null;

  const trigger = label ? (
    <button
      data-guia="menu-acoes"
      ref={triggerRef}
      type="button"
      // O nome acessível começa pelo texto visível ("Mais ações de X"), R2G-12.
      aria-label={ariaLabel.startsWith(label) ? ariaLabel : `${label}: ${ariaLabel}`}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={open ? menuId : undefined}
      onClick={(e) => {
        e.stopPropagation();
        setOpen((o) => !o);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }
      }}
      className={buttonClasses({
        variant: "secondary",
        className: cn("pointer-coarse:h-11 max-md:h-11", className),
      })}
    >
      <MoreHorizontal className="size-4" aria-hidden />
      {label}
    </button>
  ) : (
    <button
      data-guia="menu-acoes"
      ref={triggerRef}
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={open ? menuId : undefined}
      onClick={(e) => {
        e.stopPropagation();
        setOpen((o) => !o);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }
      }}
      className={cn(
        "inline-grid shrink-0 cursor-pointer place-items-center rounded-full text-neutral-500 transition hover:bg-neutral-900/[0.07] hover:text-neutral-900 aria-expanded:bg-neutral-900/[0.07] aria-expanded:text-neutral-900 pointer-coarse:size-11 max-md:size-11",
        size === "sm" ? "size-8" : "size-9",
        className,
      )}
    >
      <MoreHorizontal className="size-4" aria-hidden />
    </button>
  );

  return (
    <>
      {trigger}
      {open && (
        <MenuPanel
          id={menuId}
          items={ordered}
          triggerRef={triggerRef}
          align={align}
          labelledBy={label ? undefined : ariaLabel}
          onClose={close}
        />
      )}
    </>
  );
}

function MenuPanel({
  id,
  items,
  triggerRef,
  align,
  labelledBy,
  onClose,
}: {
  id: string;
  items: ActionMenuItem[];
  triggerRef: RefObject<HTMLButtonElement | null>;
  align: "start" | "end";
  labelledBy: string | undefined;
  onClose: (focusTrigger: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);

  // Abaixo do botão; sem espaço, acima. Nunca sai da tela pelos lados.
  useLayoutEffect(() => {
    const t = triggerRef.current?.getBoundingClientRect();
    const menu = ref.current;
    if (!t || !menu) return;
    const width = Math.min(MENU_WIDTH, window.innerWidth - MARGIN * 2);
    setPos(placeNear(t, width, menu.offsetHeight, align));
  }, [align, triggerRef]);

  // Foco no primeiro item ao abrir.
  useEffect(() => {
    // preventScroll: rolar para focar dispararia o "fecha ao rolar" logo ao abrir (celular).
    if (pos)
      ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
  }, [pos]);

  // Fecha ao clicar fora, rolar a página ou mudar o tamanho da janela.
  useEffect(() => {
    const outside = (e: PointerEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || triggerRef.current?.contains(target)) return;
      onClose(false);
    };
    const scroll = (e: Event) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose(false);
    };
    // No celular a barra de endereço muda só a altura ao tocar/rolar: fecha só se a largura mudar.
    const width = window.innerWidth;
    const resize = () => {
      if (window.innerWidth !== width) onClose(false);
    };
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", resize);
    };
  }, [onClose, triggerRef]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const nodes = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const i = nodes.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => nodes[(n + nodes.length) % nodes.length]?.focus();
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(nodes.length - 1);
    else if (e.key === "Escape") onClose(true);
    else if (e.key === "Tab") {
      onClose(false);
      return;
    } else return;
    e.preventDefault();
  };

  const firstDanger = items.findIndex((i) => i.danger);

  return createPortal(
    <div
      ref={ref}
      id={id}
      role="menu"
      aria-label={labelledBy}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onClick={stop}
      onPointerDown={stop}
      style={{
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        maxHeight: pos?.maxHeight,
        width: `min(${MENU_WIDTH}px, calc(100vw - ${MARGIN * 2}px))`,
      }}
      className="painel-modal fixed z-[75] flex flex-col overflow-y-auto rounded-2xl p-1.5 shadow-[0_24px_48px_-16px_rgb(0_0_0/0.35)] ring-1 ring-black/5 outline-none"
    >
      {items.map((item, index) => {
        const Icon = item.icon;
        const hintId = item.hint ? `${id}-dica-${index}` : undefined;
        return (
          <Fragment key={`${item.label}-${index}`}>
            {index === firstDanger && index > 0 && (
              <hr aria-hidden className="mx-2 my-1 border-neutral-200" />
            )}
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              aria-disabled={item.disabled || undefined}
              aria-describedby={hintId}
              onClick={() => {
                if (item.disabled) return;
                onClose(true);
                item.onSelect();
              }}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left text-sm outline-none transition pointer-coarse:min-h-11",
                item.disabled
                  ? "cursor-not-allowed text-neutral-400"
                  : item.danger
                    ? "cursor-pointer text-red-700 hover:bg-red-50 focus-visible:bg-red-50"
                    : "cursor-pointer text-neutral-800 hover:bg-neutral-900/[0.06] focus-visible:bg-neutral-900/[0.06]",
                item.disabled && "focus-visible:bg-neutral-900/[0.04]",
              )}
            >
              {Icon && <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />}
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{item.label}</span>
                {item.hint && (
                  <span id={hintId} className="mt-0.5 block text-xs font-normal text-neutral-500">
                    {item.hint}
                  </span>
                )}
              </span>
            </button>
          </Fragment>
        );
      })}
    </div>,
    floatingHost(triggerRef.current),
  );
}

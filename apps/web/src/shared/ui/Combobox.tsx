import { Check, ChevronDown, X } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/shared/lib/cn";
import { normalize } from "@/shared/lib/text";
import { useFieldControl } from "./Field";
import { floatingHost, placeNear } from "./floating";
import { Spinner } from "./Spinner";

// Escolha com busca: digitar filtra, setas andam, Enter escolhe, Esc fecha,
// X limpa. Uma opção (`value: string | null`) ou várias (`multiple`,
// `value: string[]`). Dentro de <Field> recebe id/erro sozinho; com
// react-hook-form, via <Controller> (`{...field}` funciona direto).

export interface ComboboxOption {
  value: string;
  label: string;
  /** Texto secundário, à direita/abaixo (ex.: "1º andar · Bloco A"). */
  description?: string;
  /** Algo à esquerda (ícone, cor da marca). */
  leading?: ReactNode;
  disabled?: boolean;
  /** Termos extras que também acham a opção na busca. */
  keywords?: string;
}

interface CommonProps {
  options: ComboboxOption[];
  placeholder?: string;
  /** Texto quando a busca não acha nada. */
  emptyText?: string;
  loading?: boolean;
  /**
   * Busca no servidor: recebe o texto digitado (o debounce é de quem chama)
   * e `options` já vem filtrado. Sem isto, o filtro é local (sem acento).
   */
  onSearch?: (query: string) => void;
  /** Mostra o X para limpar (padrão: true). */
  clearable?: boolean;
  disabled?: boolean;
  /** Nome do item escolhido quando ele não está em `options` (busca no servidor). */
  selectedLabel?: string;
  id?: string;
  name?: string;
  onBlur?: () => void;
  ref?: Ref<HTMLInputElement>;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  className?: string;
}

export interface ComboboxSingleProps extends CommonProps {
  multiple?: false;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
}

export interface ComboboxMultipleProps extends CommonProps {
  multiple: true;
  value: string[] | null | undefined;
  onChange: (value: string[]) => void;
}

export type ComboboxProps = ComboboxSingleProps | ComboboxMultipleProps;

const MAX_RENDERED = 200;

export function Combobox(props: ComboboxProps) {
  const {
    options,
    placeholder = "Escolha…",
    emptyText = "Nenhum resultado",
    loading = false,
    onSearch,
    clearable = true,
    disabled = false,
    selectedLabel,
    name,
    onBlur,
    ref,
    className,
  } = props;
  const a11y = useFieldControl(props);
  const multiple = props.multiple === true;
  const selected: string[] = multiple ? (props.value ?? []) : props.value ? [props.value] : [];

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);
  const labelOf = (v: string) => byValue.get(v)?.label ?? selectedLabel ?? "Escolhido antes";

  const filtered = useMemo(() => {
    if (onSearch || !query.trim()) return options;
    const q = normalize(query.trim());
    return options.filter((o) =>
      normalize(`${o.label} ${o.description ?? ""} ${o.keywords ?? ""}`).includes(q),
    );
  }, [options, query, onSearch]);
  const shown = filtered.slice(0, MAX_RENDERED);

  const setInput = useCallback(
    (el: HTMLInputElement | null) => {
      inputRef.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const openList = () => {
    if (disabled || open) return;
    setOpen(true);
    const first = shown.findIndex((o) => selected.includes(o.value));
    setActive(Math.max(first, 0));
  };

  const choose = (option: ComboboxOption | undefined) => {
    if (!option || option.disabled) return;
    if (props.multiple === true) {
      const has = selected.includes(option.value);
      props.onChange(
        has ? selected.filter((v) => v !== option.value) : [...selected, option.value],
      );
      setQuery("");
      onSearch?.("");
    } else {
      props.onChange(option.value);
      close();
    }
  };

  const remove = (value: string) => {
    if (props.multiple === true) props.onChange(selected.filter((v) => v !== value));
  };

  const clear = () => {
    if (props.multiple === true) props.onChange([]);
    else props.onChange(null);
    setQuery("");
    onSearch?.("");
    inputRef.current?.focus();
  };

  // Fecha ao clicar fora (o campo e a lista contam como "dentro").
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || listRef.current?.contains(t)) return;
      close();
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [open, close]);

  // Mantém a opção ativa visível ao andar com as setas.
  useEffect(() => {
    if (!open) return;
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, listId]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return openList();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (shown.length ? (i + step + shown.length) % shown.length : 0));
    } else if (e.key === "Enter") {
      if (!open) return;
      e.preventDefault(); // não envia o formulário
      choose(shown[active]);
    } else if (e.key === "Escape") {
      if (!open) return;
      e.preventDefault();
      e.stopPropagation(); // não fecha o modal em volta
      close();
    } else if (e.key === "Tab") {
      if (open) close();
    } else if (e.key === "Backspace" && multiple && !query && selected.length > 0) {
      remove(selected[selected.length - 1] as string);
    }
  };

  const single = !multiple && selected[0] ? labelOf(selected[0]) : "";
  const invalid = a11y["aria-invalid"] === true || a11y["aria-invalid"] === "true";
  const hasValue = selected.length > 0;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: clicar na moldura foca o campo (o teclado usa o input)
    <div
      ref={wrapRef}
      data-invalid={invalid || undefined}
      data-disabled={disabled || undefined}
      onClick={() => {
        inputRef.current?.focus();
        openList();
      }}
      className={cn(
        "flex min-h-10 w-full cursor-text items-center gap-1 rounded-xl border border-neutral-200 bg-white py-1 pr-1 pl-3 text-sm transition focus-within:border-neutral-900 focus-within:ring-4 focus-within:ring-neutral-900/5 data-[disabled]:cursor-not-allowed data-[disabled]:bg-neutral-50 data-[invalid]:border-red-500 data-[invalid]:focus-within:ring-red-500/10 pointer-coarse:min-h-11",
        multiple && hasValue && "pl-1",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {multiple &&
          selected.map((v) => (
            <span
              key={v}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-neutral-900/[0.07] py-0.5 pr-0.5 pl-2.5 text-xs font-medium text-neutral-800"
            >
              <span className="truncate">{labelOf(v)}</span>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Tirar ${labelOf(v)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  remove(v);
                }}
                className="grid size-5 cursor-pointer place-items-center rounded-full text-neutral-500 hover:bg-neutral-900/[0.08] hover:text-neutral-900"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
        <input
          ref={setInput}
          {...a11y}
          name={name}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-label={props["aria-label"]}
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={open && shown[active] ? `${listId}-${active}` : undefined}
          disabled={disabled}
          value={open ? query : single}
          placeholder={open && single ? single : hasValue && multiple ? "Buscar…" : placeholder}
          onFocus={openList}
          onBlur={() => onBlur?.()}
          onChange={(e) => {
            if (!open) setOpen(true);
            setQuery(e.target.value);
            setActive(0);
            onSearch?.(e.target.value);
          }}
          onKeyDown={onKeyDown}
          // A moldura mostra o foco; o contorno global do input ficaria duplicado.
          style={{ outline: "none" }}
          className="h-8 min-w-[6rem] flex-1 bg-transparent text-neutral-900 outline-none placeholder:text-neutral-400 disabled:cursor-not-allowed disabled:text-neutral-500"
        />
      </div>
      {loading && <Spinner className="size-4 text-neutral-400" />}
      {clearable && hasValue && !disabled && (
        <button
          type="button"
          aria-label="Limpar"
          onClick={(e) => {
            e.stopPropagation();
            clear();
          }}
          className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-neutral-400 hover:bg-neutral-900/[0.06] hover:text-neutral-900"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
      <ChevronDown aria-hidden className="mr-2 size-4 shrink-0 text-neutral-400" />
      {open && (
        <ListPanel
          id={listId}
          listRef={listRef}
          anchorRef={wrapRef}
          multiple={multiple}
          layoutKey={selected.length}
        >
          {shown.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-neutral-500">
              {loading ? "Buscando…" : emptyText}
            </p>
          ) : (
            shown.map((o, i) => {
              const isSelected = selected.includes(o.value);
              return (
                // biome-ignore lint/a11y/useKeyWithClickEvents: as setas e o Enter ficam no campo (aria-activedescendant)
                <div
                  key={o.value}
                  id={`${listId}-${i}`}
                  role="option"
                  tabIndex={-1}
                  aria-selected={isSelected}
                  aria-disabled={o.disabled || undefined}
                  onPointerDown={(e) => e.preventDefault()} // o foco fica no campo
                  onMouseEnter={() => setActive(i)}
                  onClick={(e) => {
                    e.stopPropagation();
                    choose(o);
                  }}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm pointer-coarse:min-h-11",
                    i === active && "bg-neutral-900/[0.06]",
                    o.disabled && "cursor-not-allowed opacity-50",
                  )}
                >
                  {o.leading}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-neutral-900">{o.label}</span>
                    {o.description && (
                      <span className="block truncate text-xs text-neutral-500">
                        {o.description}
                      </span>
                    )}
                  </span>
                  <Check
                    aria-hidden
                    className={cn("size-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")}
                  />
                </div>
              );
            })
          )}
          {filtered.length > MAX_RENDERED && (
            <p className="px-3 py-2 text-xs text-neutral-500">
              Mostrando {MAX_RENDERED} de {filtered.length}. Digite para achar o resto.
            </p>
          )}
        </ListPanel>
      )}
    </div>
  );
}

/** A lista flutuante, presa ao campo (embaixo, ou em cima se não couber). */
function ListPanel({
  id,
  listRef,
  anchorRef,
  multiple,
  layoutKey,
  children,
}: {
  id: string;
  listRef: RefObject<HTMLDivElement | null>;
  anchorRef: RefObject<HTMLDivElement | null>;
  multiple: boolean;
  /** Muda quando o campo pode ter mudado de altura (chips): reposiciona. */
  layoutKey: number;
  children: ReactNode;
}) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number }>();

  useLayoutEffect(() => {
    void layoutKey; // campo mudou de altura (chips): reposiciona
    const place = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const height = Math.min(listRef.current?.scrollHeight ?? 300, 320);
      const p = placeNear(anchor, anchor.width, height);
      setPos({ ...p, width: anchor.width, maxHeight: Math.min(p.maxHeight, 320) });
    };
    place();
    const onScroll = (e: Event) => {
      if (listRef.current?.contains(e.target as Node)) return;
      place();
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", place);
    };
  }, [anchorRef, listRef, layoutKey]);

  return createPortal(
    // biome-ignore lint/a11y/useKeyWithClickEvents: só barra o clique de subir para a linha/modal
    <div
      ref={listRef}
      id={id}
      role="listbox"
      aria-multiselectable={multiple || undefined}
      onClick={(e) => e.stopPropagation()}
      style={{
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        width: pos?.width,
        maxHeight: pos?.maxHeight ?? 320,
      }}
      className="painel-modal fixed z-[75] overflow-y-auto rounded-2xl p-1.5 shadow-[0_24px_48px_-16px_rgb(0_0_0/0.35)] ring-1 ring-black/5"
    >
      {children}
    </div>,
    floatingHost(anchorRef.current),
  );
}

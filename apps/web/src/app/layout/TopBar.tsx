import {
  couponPageSchema,
  type Permission,
  ROUTES,
  storePageSchema,
  visitorPageSchema,
} from "@arp/contracts";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CornerDownLeft,
  type LucideIcon,
  Search,
  Store,
  TicketPercent,
  UserRound,
  UserRoundCog,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { apiRequest } from "@/shared/api";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { useDebouncedValue } from "@/shared/hooks";
import { cn } from "@/shared/lib/cn";
import { formatToday } from "@/shared/lib/format";
import { activeNavItem, type NavSection, searchScreens } from "../navigation";
import { prefetchRoute } from "../prefetch";
import { GuideButton } from "./GuideButton";

/** Barra do topo: onde estou (Seção / Tela), a data e a busca (Ctrl+K). */
export function TopBar({ sections }: { sections: NavSection[] }) {
  const { pathname, search } = useLocation();
  const here = activeNavItem(sections, pathname, search);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p
        data-guia="onde-estou"
        className="flex min-h-11 items-center gap-2 text-sm text-neutral-500"
      >
        {here && here.section.title === here.item.label && (
          <span className="font-medium text-neutral-900">{here.item.label}</span>
        )}
        {here && here.section.title !== here.item.label && (
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
        <GuideButton />
        <QuickSearch sections={sections} />
      </div>
    </div>
  );
}

type Result = {
  key: string;
  to: string;
  icon: LucideIcon;
  label: string;
  /** Seção da tela ou o tipo do registro ("Loja", "Visitante"). */
  hint: string;
  group: "screens" | "records";
};

/** Quantos registros de cada tipo aparecem na busca. */
const RECORDS_PER_KIND = 3;
/** Registros só a partir de 3 letras (antes disso é ruído e carga à toa). */
const MIN_RECORD_TERM = 3;

/**
 * Registros (lojas, promoções, visitantes) que batem com o termo, cada tipo
 * só para quem pode ver a tela dele. Usa os mesmos `?q=` das listas.
 */
function useRecordResults(term: string): { results: Result[]; loading: boolean } {
  const { can, user } = useAuth();
  const q = useDebouncedValue(term.trim(), 250);
  const on = q.length >= MIN_RECORD_TERM;
  const query = { q, pageSize: RECORDS_PER_KIND };
  const enabled = (p: Permission | null) => on && can(p);
  const opts = { staleTime: 30_000, retry: false } as const;

  const stores = useQuery({
    queryKey: ["busca", "lojas", q],
    queryFn: ({ signal }) => apiRequest(ROUTES.stores.list, storePageSchema, { query, signal }),
    enabled: enabled(ROUTES.stores.list.permission) && !user?.store,
    ...opts,
  });
  const coupons = useQuery({
    queryKey: ["busca", "promocoes", q],
    queryFn: ({ signal }) => apiRequest(ROUTES.coupons.list, couponPageSchema, { query, signal }),
    enabled: enabled(ROUTES.coupons.list.permission),
    ...opts,
  });
  const visitors = useQuery({
    queryKey: ["busca", "visitantes", q],
    queryFn: ({ signal }) => apiRequest(ROUTES.visitors.list, visitorPageSchema, { query, signal }),
    enabled: enabled(ROUTES.visitors.list.permission),
    ...opts,
  });

  const results = useMemo<Result[]>(
    () => [
      ...(stores.data?.data ?? []).map((s) => ({
        key: `loja-${s.id}`,
        to: PATHS.store(s.id),
        icon: Store,
        label: s.name,
        hint: "Loja",
        group: "records" as const,
      })),
      ...(coupons.data?.data ?? []).map((c) => ({
        key: `promo-${c.id}`,
        to: PATHS.coupon(c.id),
        icon: TicketPercent,
        label: c.title,
        hint: `Promoção · ${c.store.name}`,
        group: "records" as const,
      })),
      ...(visitors.data?.data ?? []).map((v) => ({
        key: `visitante-${v.id}`,
        to: PATHS.visitor(v.id),
        icon: UserRound,
        label: v.name,
        hint: "Visitante",
        group: "records" as const,
      })),
    ],
    [stores.data, coupons.data, visitors.data],
  );
  const loading = on && (stores.isFetching || coupons.isFetching || visitors.isFetching);
  return { results: on ? results : [], loading };
}

/**
 * Busca rápida: telas (pelo nome, seção e sinônimos, sem acento nem plural)
 * e, com 3 letras ou mais, lojas, promoções e visitantes pelo nome.
 * Ctrl+K foca; setas escolhem; Enter abre; Esc sai.
 */
/** Minha conta não fica no menu (fica no pé), mas a busca acha. */
const ACCOUNT_ITEM = {
  label: "Minha conta",
  to: PATHS.account,
  icon: UserRoundCog,
  permission: null,
  section: "Conta",
  keywords: ["senha", "trocar senha", "perfil", "meus dados", "sair", "logout", "deslogar"],
};

function QuickSearch({ sections }: { sections: NavSection[] }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const records = useRecordResults(term);

  const screens = useMemo<Result[]>(() => {
    const all = [
      ...sections.flatMap((s) => s.items.map((it) => ({ ...it, section: s.title }))),
      ACCOUNT_ITEM,
    ];
    const found = term.trim() ? searchScreens(all, term) : all;
    return found.slice(0, term.trim() ? 6 : 8).map((it) => ({
      key: `tela-${it.to}`,
      to: it.to,
      icon: it.icon,
      label: it.label,
      hint: it.section,
      group: "screens",
    }));
  }, [term, sections]);

  const results = useMemo(() => [...screens, ...records.results], [screens, records.results]);

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

  // Mantém o destaque dentro da lista quando os registros chegam ou somem.
  useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(results.length - 1, 0)));
  }, [results.length]);

  // A tela em destaque na lista já começa a baixar.
  const highlighted = open ? results[index] : undefined;
  useEffect(() => {
    if (highlighted?.group === "screens") prefetchRoute(highlighted.to);
  }, [highlighted]);

  const go = (to: string) => {
    setTerm("");
    setOpen(false);
    input.current?.blur();
    navigate(to);
  };

  const activeId = open && results[index] ? `${listId}-${index}` : undefined;
  const showEmpty = results.length === 0 && !records.loading;

  return (
    <div className="relative w-full sm:w-80">
      <label
        data-guia="busca-telas"
        className="vidro flex items-center gap-2 rounded-full py-1.5 pr-3 pl-1.5 text-sm"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-neutral-900 text-white">
          <Search className="size-4" aria-hidden />
        </span>
        <span className="sr-only">Buscar tela, loja, promoção ou visitante</span>
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
          placeholder="Buscar tela, loja, visitante…"
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
          aria-label="Resultados da busca"
          className="painel-modal absolute top-full right-0 z-40 mt-2 max-h-[70dvh] w-full overflow-y-auto rounded-3xl p-1.5 sm:w-96"
        >
          {showEmpty ? (
            <p className="px-3 py-2 text-sm text-neutral-500">
              Nada encontrado. Tente outra palavra (ex.: “push”, “pontos”, “banner”).
            </p>
          ) : (
            results.map((r, i) => {
              const Icon = r.icon;
              const on = i === index;
              const firstRecord = r.group === "records" && results[i - 1]?.group !== "records";
              return (
                <div key={r.key}>
                  {firstRecord && (
                    <p
                      role="presentation"
                      className="px-3 pt-2 pb-1 text-[11px] font-medium tracking-wider text-neutral-400 uppercase"
                    >
                      Registros
                    </p>
                  )}
                  <div
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={on}
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => go(r.to)}
                    onKeyDown={() => undefined}
                    onMouseEnter={() => setIndex(i)}
                    className={cn(
                      "flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm",
                      on ? "bg-neutral-900 text-white" : "text-neutral-700",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="flex-1 truncate">
                      {r.label} <span className="opacity-60">· {r.hint}</span>
                    </span>
                    {on && <CornerDownLeft className="size-3.5 opacity-70" aria-hidden />}
                  </div>
                </div>
              );
            })
          )}
          {records.loading && (
            <p className="px-3 py-2 text-xs text-neutral-500" aria-live="polite">
              Buscando registros…
            </p>
          )}
        </div>
      )}
    </div>
  );
}

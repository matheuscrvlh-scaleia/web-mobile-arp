import { buildDeepLink, type DeepLinkTarget, parseDeepLink } from "@arp/contracts";
import {
  CalendarDays,
  House,
  LayoutGrid,
  Link2,
  type LucideIcon,
  Store,
  TicketPercent,
  TriangleAlert,
} from "lucide-react";
import { useId } from "react";
import { useCoupon } from "@/features/coupons";
import { useEvent } from "@/features/events";
import {
  CouponPicker,
  EventPicker,
  StorePicker,
  TARGET_ISSUE_TEXT,
  useTargetIssue,
} from "@/features/highlights";
import { cn } from "@/shared/lib/cn";
import { Field, Input, Select } from "@/shared/ui";

export type LinkKind = DeepLinkTarget["kind"];

const KINDS: { value: LinkKind; label: string; icon: LucideIcon }[] = [
  { value: "home", label: "Início do app", icon: House },
  { value: "event", label: "Evento", icon: CalendarDays },
  { value: "coupon", label: "Cupom", icon: TicketPercent },
  { value: "store", label: "Loja", icon: Store },
  { value: "screen", label: "Tela do app", icon: LayoutGrid },
  { value: "url", label: "Link (site)", icon: Link2 },
];

const SCREEN_LABEL: Record<string, string> = {
  agenda: "Agenda",
  cupons: "Cupons",
  desafios: "Desafios",
  mapa: "Mapa",
  lojas: "Lojas",
  carteira: "Carteira (cupons pegos)",
};

/** Tipo do destino de um link salvo (link que o app não abre conta como "Início"). */
export const linkKindOf = (link: string | null | undefined): LinkKind =>
  parseDeepLink(link)?.kind ?? "home";

/** "Escolha o evento" quando o tipo pede um item e nada foi escolhido. */
export function missingTarget(kind: LinkKind, link: string | null | undefined): string | null {
  if (parseDeepLink(link)?.kind === kind) return null;
  if (kind === "event") return "Escolha o evento";
  if (kind === "coupon") return "Escolha o cupom";
  if (kind === "store") return "Escolha a loja";
  if (kind === "screen") return "Escolha a tela";
  if (kind === "url") return "Informe o link";
  return null;
}

/** "Abre o cupom “Black Friday” · Milkymoo" (resumo da confirmação e do detalhe). */
export function useDeepLinkSummary(link: string | null | undefined): string {
  const target = parseDeepLink(link);
  const event = useEvent(target?.kind === "event" ? target.id : undefined);
  const coupon = useCoupon(target?.kind === "coupon" ? target.id : undefined);
  if (!target || target.kind === "home") return "Abre o início do app";
  if (target.kind === "event") return `Abre o evento “${event.data?.title ?? "…"}”`;
  if (target.kind === "coupon") {
    const c = coupon.data;
    return c ? `Abre o cupom “${c.title}” · ${c.store.name}` : "Abre o cupom “…”";
  }
  if (target.kind === "store") return "Abre a página da loja";
  if (target.kind === "screen")
    return `Abre a tela ${SCREEN_LABEL[target.screen] ?? target.screen}`;
  return target.kind === "url" ? `Abre ${target.url} no navegador` : "Abre o início do app";
}

const ISSUE_NOUN = { event: "Este evento", coupon: "Este cupom", store: "Esta loja" } as const;

/**
 * Aviso quando o destino não abre direito no app (cupom pausado ou encerrado,
 * evento em rascunho…). Evento cancelado não avisa: é o caso do aviso de
 * cancelamento, que leva de propósito para a página do evento.
 */
export function useDeepLinkIssue(link: string | null | undefined): string | null {
  const target = parseDeepLink(link);
  const kind =
    target?.kind === "event" || target?.kind === "coupon" || target?.kind === "store"
      ? target.kind
      : null;
  const issue = useTargetIssue(kind, kind && target && "id" in target ? target.id : null);
  if (!kind || !issue || (kind === "event" && issue === "cancelled")) return null;
  const it = kind === "store" ? "encontrá-la" : "encontrá-lo";
  return `${ISSUE_NOUN[kind]} ${TARGET_ISSUE_TEXT[issue]}. Quem tocar no aviso não vai ${it}.`;
}

/** Faixa âmbar com o aviso do destino (formulário, confirmação e detalhe). */
export function DeepLinkIssue({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p className="flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{text}</span>
    </p>
  );
}

const withHttps = (v: string) =>
  !v.trim() || /^[a-z][a-z0-9+.-]*:/i.test(v.trim()) ? v.trim() : `https://${v.trim()}`;

/**
 * "Ao tocar": o mesmo seletor dos Destaques (evento, cupom, loja com busca),
 * montando o link do app sozinho. Ninguém digita `arp://`.
 */
export function DeepLinkField({
  kind,
  onKindChange,
  value,
  onChange,
  error,
  disabled = false,
}: {
  kind: LinkKind;
  onKindChange: (kind: LinkKind) => void;
  value: string | null | undefined;
  onChange: (link: string | null) => void;
  error?: string;
  disabled?: boolean;
}) {
  const name = useId();
  const target = parseDeepLink(value);
  const idOf = (k: "event" | "coupon" | "store") => (target?.kind === k ? target.id : null);
  const event = useEvent(target?.kind === "event" ? target.id : undefined);
  const coupon = useCoupon(target?.kind === "coupon" ? target.id : undefined);
  const pick = (k: "event" | "coupon" | "store") => (id: string | null) =>
    onChange(id ? buildDeepLink({ kind: k, id }) : null);
  const issue = useDeepLinkIssue(target?.kind === kind ? value : null);

  return (
    <div className="flex flex-col gap-3">
      <fieldset
        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
        disabled={disabled}
        aria-label="Ao tocar, abre"
      >
        {KINDS.map(({ value: k, label, icon: Icon }) => (
          <label
            key={k}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm transition hover:border-neutral-400 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-neutral-900/50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60",
              kind === k && "border-neutral-900 font-medium ring-1 ring-neutral-900",
            )}
          >
            <input
              type="radio"
              name={name}
              value={k}
              checked={kind === k}
              onChange={() => {
                onKindChange(k);
                onChange(null);
              }}
              className="sr-only"
            />
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </label>
        ))}
      </fieldset>

      {kind === "event" && (
        <Field label="Evento" required error={error}>
          <EventPicker
            value={idOf("event")}
            selectedLabel={event.data?.title}
            onChange={pick("event")}
            disabled={disabled}
          />
        </Field>
      )}
      {kind === "coupon" && (
        <Field label="Cupom" required error={error}>
          <CouponPicker
            value={idOf("coupon")}
            selectedLabel={coupon.data?.title}
            onChange={pick("coupon")}
            disabled={disabled}
          />
        </Field>
      )}
      {kind === "store" && (
        <Field label="Loja" required error={error}>
          <StorePicker value={idOf("store")} onChange={pick("store")} disabled={disabled} />
        </Field>
      )}
      {kind === "screen" && (
        <Field label="Tela" required error={error}>
          <Select
            placeholder="Escolha a tela"
            value={target?.kind === "screen" ? target.screen : ""}
            onChange={(e) =>
              onChange(
                e.target.value ? buildDeepLink({ kind: "screen", screen: e.target.value }) : null,
              )
            }
            disabled={disabled}
          >
            {Object.entries(SCREEN_LABEL).map(([screen, label]) => (
              <option key={screen} value={screen}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {kind === "url" && (
        <Field
          label="Link"
          required
          hint="Abre no navegador do celular. O https:// entra sozinho."
          error={error}
        >
          <Input
            type="url"
            inputMode="url"
            placeholder="arp.com.br/natal"
            defaultValue={target?.kind === "url" ? target.url : ""}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value.trim() || null)}
            onBlur={(e) => {
              const v = withHttps(e.target.value);
              e.target.value = v;
              onChange(v || null);
            }}
          />
        </Field>
      )}
      {kind === "home" && error && <p className="text-sm text-red-600">{error}</p>}
      <DeepLinkIssue text={issue} />
    </div>
  );
}

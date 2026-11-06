import type { HighlightTarget } from "@arp/contracts";
import {
  CalendarDays,
  CircleSlash,
  Link2,
  Store,
  TicketPercent,
  TriangleAlert,
} from "lucide-react";
import { useId } from "react";
import { Controller, type UseFormReturn, useWatch } from "react-hook-form";
import { cn } from "@/shared/lib/cn";
import { Field, Input, type TabItem } from "@/shared/ui";
import type { HighlightFormInput, HighlightFormValues } from "../../lib/form";
import { withHttps } from "../../lib/form";
import { TARGET_LABEL } from "../HighlightBadges";
import {
  CouponPicker,
  EventPicker,
  StorePicker,
  TARGET_ISSUE_TEXT,
  useTargetIssue,
} from "./TargetPickers";

type Form = UseFormReturn<HighlightFormInput, unknown, HighlightFormValues>;

const OPTIONS: TabItem<HighlightTarget>[] = [
  { value: "event", label: TARGET_LABEL.event, icon: CalendarDays },
  { value: "coupon", label: TARGET_LABEL.coupon, icon: TicketPercent },
  { value: "store", label: TARGET_LABEL.store, icon: Store },
  { value: "url", label: TARGET_LABEL.url, icon: Link2 },
  { value: "none", label: "Nenhum", icon: CircleSlash },
];

const TARGET_NOUN = { event: "Este evento", coupon: "Este cupom", store: "Esta loja" } as const;

/** Para onde o toque no slide leva: evento, cupom, loja, link ou lugar nenhum. */
export function TargetFields({
  form,
  readOnly,
  currentLabel,
}: {
  form: Form;
  readOnly: boolean;
  /** Nome do destino salvo (vem da API), para mostrar sem outra consulta. */
  currentLabel: string | null | undefined;
}) {
  const { control, setValue, formState } = form;
  const { errors } = formState;
  const [targetType, targetId] = useWatch({ control, name: ["targetType", "targetId"] });
  const entity =
    targetType === "event" || targetType === "coupon" || targetType === "store" ? targetType : null;
  const issue = useTargetIssue(entity, targetId);
  const name = useId();

  return (
    <>
      <Field label="Destino" error={errors.targetType?.message}>
        <Controller
          control={control}
          name="targetType"
          render={({ field }) => (
            // Cartões em grade (como o "Ao tocar" do push): no celular as 5
            // opções aparecem todas, sem rolagem escondida.
            <fieldset
              className="grid grid-cols-2 gap-2 sm:grid-cols-5"
              disabled={readOnly}
              aria-label="Destino"
            >
              {OPTIONS.map(({ value, label, icon: Icon }) => {
                const on = (field.value ?? "none") === value;
                return (
                  <label
                    key={value}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm transition hover:border-neutral-400 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-neutral-900/50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60",
                      on && "border-neutral-900 font-medium ring-1 ring-neutral-900",
                    )}
                  >
                    <input
                      type="radio"
                      name={name}
                      value={value}
                      checked={on}
                      onChange={() => {
                        field.onChange(value);
                        setValue("targetId", null, { shouldDirty: true });
                        setValue("targetUrl", null, { shouldDirty: true });
                      }}
                      className="sr-only"
                    />
                    {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
                    {label}
                  </label>
                );
              })}
            </fieldset>
          )}
        />
      </Field>
      {entity && (
        <Field label={TARGET_LABEL[entity]} required error={errors.targetId?.message}>
          <Controller
            control={control}
            name="targetId"
            render={({ field }) => {
              const props = {
                value: field.value,
                onChange: field.onChange,
                onBlur: field.onBlur,
                name: field.name,
                selectedLabel: currentLabel,
                disabled: readOnly,
              };
              return entity === "event" ? (
                <EventPicker {...props} />
              ) : entity === "coupon" ? (
                <CouponPicker {...props} />
              ) : (
                <StorePicker {...props} />
              );
            }}
          />
        </Field>
      )}
      {entity && issue && (
        <output className="flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {TARGET_NOUN[entity]} {TARGET_ISSUE_TEXT[issue]}. Escolha outro destino ou ajuste{" "}
          {entity === "store" ? "a loja" : `o ${TARGET_LABEL[entity].toLowerCase()}`} antes de
          publicar.
        </output>
      )}
      {targetType === "url" && (
        <Field
          label="Link"
          required
          hint="Abre no navegador do celular. O https:// entra sozinho."
          error={errors.targetUrl?.message}
        >
          <Controller
            control={control}
            name="targetUrl"
            render={({ field }) => (
              <Input
                type="url"
                inputMode="url"
                placeholder="arp.com.br/natal"
                value={field.value ?? ""}
                name={field.name}
                ref={field.ref}
                onChange={(e) => field.onChange(e.target.value || null)}
                onBlur={() => {
                  field.onChange(withHttps(field.value));
                  field.onBlur();
                }}
              />
            )}
          />
        </Field>
      )}
    </>
  );
}

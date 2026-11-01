import type { HighlightTarget } from "@arp/contracts";
import { CalendarDays, CircleSlash, Link2, Store, TicketPercent } from "lucide-react";
import { Controller, type UseFormReturn, useWatch } from "react-hook-form";
import { emptyToNull } from "@/shared/lib/text";
import { Field, Input, Segmented, type TabItem } from "@/shared/ui";
import type { HighlightFormInput, HighlightFormValues } from "../../lib/form";
import { TARGET_LABEL } from "../HighlightBadges";
import { CouponPicker, EventPicker, StorePicker } from "./TargetPickers";

type Form = UseFormReturn<HighlightFormInput, unknown, HighlightFormValues>;

const OPTIONS: TabItem<HighlightTarget>[] = [
  { value: "event", label: TARGET_LABEL.event, icon: CalendarDays },
  { value: "coupon", label: TARGET_LABEL.coupon, icon: TicketPercent },
  { value: "store", label: TARGET_LABEL.store, icon: Store },
  { value: "url", label: TARGET_LABEL.url, icon: Link2 },
  { value: "none", label: "Nenhum", icon: CircleSlash },
];

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
  const { control, register, setValue, formState } = form;
  const { errors } = formState;
  const targetType = useWatch({ control, name: "targetType" });

  return (
    <>
      <Field label="Destino" error={errors.targetType?.message}>
        <Controller
          control={control}
          name="targetType"
          render={({ field }) => (
            <Segmented
              label="Destino"
              size="sm"
              options={OPTIONS}
              value={field.value ?? "none"}
              onChange={(v) => {
                field.onChange(v);
                setValue("targetId", null, { shouldDirty: true });
                setValue("targetUrl", null, { shouldDirty: true });
              }}
              className={readOnly ? "pointer-events-none opacity-70" : undefined}
            />
          )}
        />
      </Field>
      {(targetType === "event" || targetType === "coupon" || targetType === "store") && (
        <Field label={TARGET_LABEL[targetType]} required error={errors.targetId?.message}>
          <Controller
            control={control}
            name="targetId"
            render={({ field }) => {
              const props = {
                value: field.value,
                onChange: field.onChange,
                selectedLabel: currentLabel,
                disabled: readOnly,
              };
              return targetType === "event" ? (
                <EventPicker {...props} />
              ) : targetType === "coupon" ? (
                <CouponPicker {...props} />
              ) : (
                <StorePicker {...props} />
              );
            }}
          />
        </Field>
      )}
      {targetType === "url" && (
        <Field
          label="Link"
          required
          hint="Abre no navegador do celular."
          error={errors.targetUrl?.message}
        >
          <Input
            type="url"
            placeholder="https://"
            {...register("targetUrl", { setValueAs: emptyToNull })}
          />
        </Field>
      )}
    </>
  );
}

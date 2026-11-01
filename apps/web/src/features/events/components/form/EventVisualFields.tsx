import { Image, Palette } from "lucide-react";
import { useState } from "react";
import { Controller, useWatch } from "react-hook-form";
import { Field, IconPicker, ImageUpload, Segmented, TonePicker } from "@/shared/ui";
import type { EventFormHandle } from "./types";

type Visual = "foto" | "tom";

/** Foto, ou tom + ícone (o app desenha o cartão sem foto com eles). */
export function EventVisualFields({
  form,
  readOnly,
  categoryIcon,
}: {
  form: EventFormHandle;
  readOnly: boolean;
  /** Ícone da categoria: o padrão quando o evento não escolhe um. */
  categoryIcon: string | undefined;
}) {
  const { control, formState, setValue } = form;
  const { errors } = formState;
  const imageUrl = useWatch({ control, name: "imageUrl" });
  const [visual, setVisual] = useState<Visual>(imageUrl ? "foto" : "tom");

  return (
    <>
      <Segmented
        label="Visual do cartão"
        value={visual}
        onChange={(v) => {
          setVisual(v);
          if (v === "tom" && imageUrl) setValue("imageUrl", null, { shouldDirty: true });
        }}
        options={[
          { value: "foto", label: "Foto", icon: Image },
          { value: "tom", label: "Tom e ícone", icon: Palette },
        ]}
        className={readOnly ? "pointer-events-none w-fit opacity-70" : "w-fit"}
      />
      {visual === "foto" ? (
        <Field
          label="Foto"
          error={errors.imageUrl?.message}
          hint="Sem foto, o app usa o tom e o ícone."
        >
          <Controller
            control={control}
            name="imageUrl"
            render={({ field }) => (
              <ImageUpload
                label="foto do evento"
                value={field.value}
                onChange={field.onChange}
                disabled={readOnly}
              />
            )}
          />
        </Field>
      ) : (
        <>
          <Field label="Tom do cartão" error={errors.tone?.message}>
            <Controller
              control={control}
              name="tone"
              render={({ field }) => (
                <TonePicker value={field.value} onChange={field.onChange} disabled={readOnly} />
              )}
            />
          </Field>
          <Field
            label="Ícone"
            optional
            hint={categoryIcon ? "Sem escolher, usa o ícone da categoria." : undefined}
            error={errors.icon?.message}
          >
            <Controller
              control={control}
              name="icon"
              render={({ field }) => (
                <IconPicker
                  value={field.value ?? categoryIcon ?? ""}
                  onChange={field.onChange}
                  disabled={readOnly}
                />
              )}
            />
          </Field>
        </>
      )}
    </>
  );
}

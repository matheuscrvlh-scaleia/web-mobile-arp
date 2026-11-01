import {
  createStoreBodySchema,
  STORE_KIND_LABEL,
  type StoreDetail,
  storeKindSchema,
} from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { Controller, type UseFormReturn, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { useBlocks, useStoreCategories } from "@/features/catalog";
import { useFloors } from "@/features/map";
import { useUnsavedChangesGuard } from "@/shared/hooks";
import { formatNumber } from "@/shared/lib/format";
import { emptyToNull, slugify } from "@/shared/lib/text";
import {
  Card,
  ColorInput,
  Field,
  FieldRow,
  FormSection,
  IconPicker,
  ImageUpload,
  Input,
  SaveBar,
  Select,
  Switch,
  Textarea,
} from "@/shared/ui";
import { StoreCover } from "./StoreCard";

/** Dados da loja (horários e posição no mapa têm abas próprias). */
export const storeFormSchema = createStoreBodySchema.omit({ hours: true, mapX: true, mapY: true });
export type StoreFormInput = z.input<typeof storeFormSchema>;
export type StoreFormValues = z.output<typeof storeFormSchema>;
export type StoreForm = UseFormReturn<StoreFormInput, unknown, StoreFormValues>;
export interface StoreFormContext {
  form: StoreForm;
  /** Libera a saída da tela (depois de criar, antes de navegar). */
  allowLeave: () => void;
}

export const STORE_FORM_FIELDS = Object.keys(storeFormSchema.shape);

export function storeToFormValues(store?: StoreDetail): StoreFormInput {
  return {
    name: store?.name ?? "",
    slug: store?.slug,
    categoryId: store?.category.id ?? "",
    blockId: store?.block.id ?? "",
    floorId: store?.floor.id ?? "",
    description: store?.description ?? "",
    icon: store?.icon ?? "store",
    brandColor: store?.brandColor ?? "#2f7d3d",
    coverImageUrl: store?.coverImageUrl ?? null,
    logoUrl: store?.logoUrl ?? null,
    phone: store?.phone ?? null,
    whatsapp: store?.whatsapp ?? null,
    instagram: store?.instagram ?? null,
    website: store?.website ?? null,
    status: store?.status ?? "active",
  };
}

const nullable = { setValueAs: emptyToNull };
const DESCRIPTION_MAX = 600;

/**
 * Formulário dos dados da loja (criar e editar). Valida com o schema do
 * contrato; quem usa decide o que enviar (criar manda tudo, editar só o
 * que mudou).
 */
export function StoreForm({
  store,
  onSubmit,
  saving,
  readOnly = false,
  submitLabel,
}: {
  store?: StoreDetail;
  onSubmit: (values: StoreFormValues, ctx: StoreFormContext) => void;
  saving: boolean;
  readOnly?: boolean;
  submitLabel: string;
}) {
  const creating = !store;
  const form: StoreForm = useForm<StoreFormInput, unknown, StoreFormValues>({
    resolver: zodResolver(storeFormSchema),
    // Ao recarregar a loja, atualiza o que a pessoa não mexeu.
    values: useMemo(() => storeToFormValues(store), [store]),
    resetOptions: { keepDirtyValues: true },
  });
  const { register, control, formState } = form;
  const { errors, isDirty } = formState;
  const { allowLeave } = useUnsavedChangesGuard(isDirty && !saving);

  const categories = useStoreCategories();
  const blocks = useBlocks();
  const floors = useFloors();
  const [name, slug, icon, brandColor, coverImageUrl, description] = useWatch({
    control,
    name: ["name", "slug", "icon", "brandColor", "coverImageUrl", "description"],
  });

  return (
    <form onSubmit={form.handleSubmit((v) => onSubmit(v, { form, allowLeave }))} noValidate>
      <fieldset disabled={readOnly} className="min-w-0">
        <Card padding="lg">
          <FormSection
            title="Identificação"
            description="Como a loja aparece na busca e no guia do app."
          >
            <FieldRow>
              <Field label="Nome" required error={errors.name?.message}>
                <Input autoFocus={creating} {...register("name")} />
              </Field>
              <Field
                label="Endereço no app (slug)"
                optional
                hint={
                  !slug && name
                    ? `Sem preencher: ${slugify(name)}`
                    : "Letras minúsculas, números e hífens."
                }
                error={errors.slug?.message}
              >
                <Input
                  className="font-mono"
                  placeholder={slugify(name ?? "") || "casa-brava"}
                  {...register("slug", { setValueAs: (v: unknown) => (v === "" ? undefined : v) })}
                />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Categoria" required error={errors.categoryId?.message}>
                <Select placeholder="Escolha a categoria" {...register("categoryId")}>
                  {storeKindSchema.options.map((kind) => (
                    <optgroup key={kind} label={STORE_KIND_LABEL[kind]}>
                      {(categories.data ?? [])
                        .filter((c) => c.kind === kind)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </Select>
              </Field>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <div className="flex items-end pb-1">
                    <Switch
                      checked={field.value === "active"}
                      onCheckedChange={(on) => field.onChange(on ? "active" : "inactive")}
                      label="Loja ativa"
                      description="Inativa some do app, mas o histórico continua."
                      disabled={readOnly}
                    />
                  </div>
                )}
              />
            </FieldRow>
          </FormSection>

          <FormSection
            title="Onde fica"
            description="Bloco e andar. O ponto exato no mapa fica na aba Localização."
          >
            <FieldRow>
              <Field label="Bloco" required error={errors.blockId?.message}>
                <Select placeholder="Escolha o bloco" {...register("blockId")}>
                  {(blocks.data ?? []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Andar" required error={errors.floorId?.message}>
                <Select placeholder="Escolha o andar" {...register("floorId")}>
                  {(floors.data ?? []).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </FieldRow>
          </FormSection>

          <FormSection
            title="Visual"
            description="Ícone e cor aparecem no pino do mapa e nos cartões sem foto."
          >
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
              <div className="flex flex-col gap-4">
                <Field label="Ícone" required error={errors.icon?.message}>
                  <Controller
                    control={control}
                    name="icon"
                    render={({ field }) => (
                      <IconPicker
                        value={field.value}
                        onChange={field.onChange}
                        color={brandColor}
                        disabled={readOnly}
                      />
                    )}
                  />
                </Field>
                <Field label="Cor da marca" required error={errors.brandColor?.message}>
                  <Controller
                    control={control}
                    name="brandColor"
                    render={({ field }) => (
                      <ColorInput
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        disabled={readOnly}
                      />
                    )}
                  />
                </Field>
              </div>
              <div aria-hidden className="hidden lg:block">
                <p className="mb-2 text-xs font-medium text-neutral-500">Prévia do cartão</p>
                <div className="vidro overflow-hidden rounded-[1.5rem] p-2">
                  <div className="aspect-[16/9] overflow-hidden rounded-[1.1rem]">
                    <StoreCover
                      store={{
                        coverImageUrl: coverImageUrl ?? null,
                        brandColor: /^#[0-9a-fA-F]{6}$/.test(brandColor) ? brandColor : "#2f7d3d",
                        icon,
                        name,
                      }}
                    />
                  </div>
                  <p className="truncate px-2 pt-2 pb-1 text-sm font-semibold">
                    {name || "Nome da loja"}
                  </p>
                </div>
              </div>
            </div>
            <FieldRow>
              <Field label="Foto de capa" optional error={errors.coverImageUrl?.message}>
                <Controller
                  control={control}
                  name="coverImageUrl"
                  render={({ field }) => (
                    <ImageUpload
                      label="foto de capa"
                      value={field.value}
                      onChange={field.onChange}
                      disabled={readOnly}
                    />
                  )}
                />
              </Field>
              <Field label="Logo" optional error={errors.logoUrl?.message}>
                <Controller
                  control={control}
                  name="logoUrl"
                  render={({ field }) => (
                    <ImageUpload
                      label="logo"
                      aspect="square"
                      value={field.value}
                      onChange={field.onChange}
                      disabled={readOnly}
                    />
                  )}
                />
              </Field>
            </FieldRow>
          </FormSection>

          <FormSection title="Sobre" description="Texto da página da loja no app.">
            <Field
              label="Descrição"
              optional
              action={`${formatNumber((description ?? "").length)}/${DESCRIPTION_MAX}`}
              error={errors.description?.message}
            >
              <Textarea rows={4} maxLength={DESCRIPTION_MAX} {...register("description")} />
            </Field>
          </FormSection>

          <FormSection title="Contato" description="Aparecem como botões na página da loja.">
            <FieldRow>
              <Field label="Telefone" optional error={errors.phone?.message}>
                <Input type="tel" placeholder="(22) 2222-0000" {...register("phone", nullable)} />
              </Field>
              <Field label="WhatsApp" optional error={errors.whatsapp?.message}>
                <Input
                  type="tel"
                  placeholder="(22) 99999-0000"
                  {...register("whatsapp", nullable)}
                />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field
                label="Instagram"
                optional
                hint="Só o usuário, sem @."
                error={errors.instagram?.message}
              >
                <Input placeholder="casabrava" {...register("instagram", nullable)} />
              </Field>
              <Field label="Site" optional error={errors.website?.message}>
                <Input type="url" placeholder="https://" {...register("website", nullable)} />
              </Field>
            </FieldRow>
          </FormSection>
        </Card>
      </fieldset>
      {!readOnly && (
        <SaveBar
          dirty={isDirty}
          saving={saving}
          alwaysVisible={creating}
          onReset={creating ? undefined : () => form.reset()}
          submitLabel={submitLabel}
        />
      )}
    </form>
  );
}

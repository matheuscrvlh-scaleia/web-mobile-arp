import {
  ART_POINT_KIND_LABEL,
  type ArtPoint,
  artPointKindSchema,
  createArtPointBodySchema,
} from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { saveInput } from "@/shared/lib/forms";
import {
  Button,
  Field,
  FieldRow,
  ImageUpload,
  Input,
  Modal,
  Select,
  Switch,
  Textarea,
  toast,
} from "@/shared/ui";
import { useSaveArtPoint } from "../api";

type Input_ = z.input<typeof createArtPointBodySchema>;
type Values = z.output<typeof createArtPointBodySchema>;

const FIELDS = [
  "number",
  "name",
  "artist",
  "place",
  "kind",
  "description",
  "imageUrl",
  "mapX",
  "mapY",
] as const;

const optionalNumber = { setValueAs: (v: unknown) => (v === "" || v === null ? null : Number(v)) };

function toValues(p?: ArtPoint): Input_ {
  return {
    number: p?.number ?? 1,
    name: p?.name ?? "",
    artist: p?.artist ?? "",
    place: p?.place ?? "",
    kind: p?.kind ?? "work",
    description: p?.description ?? "",
    imageUrl: p?.imageUrl ?? null,
    mapX: p?.mapX ?? null,
    mapY: p?.mapY ?? null,
    active: p?.active ?? true,
  };
}

/** Ponto do Circuito Cultural: número, nome, artista, local, tipo e posição no mapa. */
export function ArtPointFormModal({
  open,
  point,
  nextNumber,
  onClose,
}: {
  open: boolean;
  point?: ArtPoint;
  nextNumber: number;
  onClose: () => void;
}) {
  const save = useSaveArtPoint();
  const form = useForm<Input_, unknown, Values>({
    resolver: zodResolver(createArtPointBodySchema),
    values: point ? toValues(point) : { ...toValues(), number: nextNumber },
  });
  const { errors } = form.formState;
  const close = () => {
    form.reset();
    save.reset();
    onClose();
  };
  const onSubmit = form.handleSubmit((values) =>
    save.mutate(saveInput(point?.id, values, form.formState.dirtyFields), {
      onSuccess: () => {
        toast.success(point ? "Ponto salvo." : "Ponto criado.");
        close();
      },
      onError: (e) => {
        if (!applyApiErrors(e, form.setError, [...FIELDS])) toast.error(errorMessage(e));
      },
    }),
  );

  return (
    <Modal
      open={open}
      onClose={close}
      busy={save.isPending}
      title={point ? `Editar ${point.name}` : "Novo ponto do Circuito"}
      description="Aparece no mapa e na lista do Circuito Cultural no app."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="form-ponto-arte" loading={save.isPending}>
            {point ? "Salvar" : "Criar ponto"}
          </Button>
        </>
      }
    >
      <form id="form-ponto-arte" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FieldRow>
          <Field label="Número" required hint="Como no mapa da ARP" error={errors.number?.message}>
            <Input
              type="number"
              min={1}
              max={999}
              {...form.register("number", { valueAsNumber: true })}
            />
          </Field>
          <Field label="Tipo" required error={errors.kind?.message}>
            <Select {...form.register("kind")}>
              {artPointKindSchema.options.map((k) => (
                <option key={k} value={k}>
                  {ART_POINT_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
        </FieldRow>
        <Field label="Nome" required error={errors.name?.message}>
          <Input autoFocus {...form.register("name")} />
        </Field>
        <FieldRow>
          <Field label="Artista" optional error={errors.artist?.message}>
            <Input {...form.register("artist")} />
          </Field>
          <Field label="Local" optional error={errors.place?.message}>
            <Input placeholder="Praça dos Contêineres" {...form.register("place")} />
          </Field>
        </FieldRow>
        <Field label="Descrição" optional error={errors.description?.message}>
          <Textarea rows={3} maxLength={600} {...form.register("description")} />
        </Field>
        <Field label="Foto" optional error={errors.imageUrl?.message}>
          <Controller
            control={form.control}
            name="imageUrl"
            render={({ field }) => (
              <ImageUpload label="foto do ponto" value={field.value} onChange={field.onChange} />
            )}
          />
        </Field>
        <FieldRow>
          <Field
            label="Posição X (%)"
            optional
            hint="0 = esquerda, 100 = direita do mapa"
            error={errors.mapX?.message}
          >
            <Input
              type="number"
              min={0}
              max={100}
              step={0.1}
              {...form.register("mapX", optionalNumber)}
            />
          </Field>
          <Field
            label="Posição Y (%)"
            optional
            hint="0 = topo, 100 = base do mapa"
            error={errors.mapY?.message}
          >
            <Input
              type="number"
              min={0}
              max={100}
              step={0.1}
              {...form.register("mapY", optionalNumber)}
            />
          </Field>
        </FieldRow>
        <Controller
          control={form.control}
          name="active"
          render={({ field }) => (
            <Switch
              checked={field.value ?? true}
              onCheckedChange={field.onChange}
              label="Aparece no app"
            />
          )}
        />
      </form>
    </Modal>
  );
}

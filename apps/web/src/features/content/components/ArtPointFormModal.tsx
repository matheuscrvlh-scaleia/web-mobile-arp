import {
  ART_POINT_KIND_LABEL,
  type ArtPoint,
  artPointKindSchema,
  createArtPointBodySchema,
} from "@arp/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { MapPinOff } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { applyApiErrors, errorMessage } from "@/shared/api";
import { saveInput } from "@/shared/lib/forms";
import {
  Button,
  confirmar,
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
import { CircuitMap, type MapPoint, NoMapImage } from "./CircuitMap";

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

/** Perguntar antes de fechar um modal com algo digitado (Esc, clique fora, X, Voltar). */
export async function confirmDiscard(dirty: boolean, what: string): Promise<boolean> {
  if (!dirty) return true;
  return confirmar({
    title: `Descartar ${what}?`,
    description: "O que você digitou neste formulário se perde.",
    confirmLabel: "Descartar",
    cancelLabel: "Continuar editando",
    danger: true,
  });
}

/**
 * Ponto do Circuito Cultural: número, nome, artista, local, tipo e a posição,
 * marcada clicando (ou arrastando o pino) no mapa do Circuito.
 */
export function ArtPointFormModal({
  open,
  point,
  nextNumber,
  mapUrl,
  others,
  onClose,
}: {
  open: boolean;
  point?: ArtPoint;
  nextNumber: number;
  /** Imagem do mapa (Textos → Circuito Cultural); null = ainda não enviada. */
  mapUrl: string | null;
  /** Os outros pontos já posicionados (referência no mapa). */
  others: MapPoint[];
  onClose: () => void;
}) {
  const save = useSaveArtPoint();
  const form = useForm<Input_, unknown, Values>({
    resolver: zodResolver(createArtPointBodySchema),
    values: point ? toValues(point) : { ...toValues(), number: nextNumber },
  });
  const { errors, isDirty } = form.formState;
  const [mapX, mapY, name] = useWatch({ control: form.control, name: ["mapX", "mapY", "name"] });
  const close = () => {
    form.reset();
    save.reset();
    onClose();
  };
  const requestClose = async () => {
    if (await confirmDiscard(isDirty, point ? "as alterações" : "o novo ponto")) close();
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
  const setPos = (pos: { x: number; y: number } | null) => {
    form.setValue("mapX", pos?.x ?? null, { shouldDirty: true });
    form.setValue("mapY", pos?.y ?? null, { shouldDirty: true });
  };
  const hasPos = typeof mapX === "number" && typeof mapY === "number";

  return (
    <Modal
      open={open}
      onClose={() => void requestClose()}
      busy={save.isPending}
      size="lg"
      title={point ? `Editar ${point.name}` : "Novo ponto do Circuito"}
      description="Aparece no mapa e na lista do Circuito Cultural no app."
      footer={
        <>
          <Button variant="secondary" onClick={() => void requestClose()} disabled={save.isPending}>
            Voltar
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
        <Field
          label="Posição no mapa"
          optional
          hint={
            !mapUrl
              ? undefined
              : hasPos
                ? "Arraste o pino (ou use as setas do teclado) para ajustar."
                : "Clique no mapa onde o ponto fica."
          }
          action={
            hasPos ? (
              <button
                type="button"
                onClick={() => setPos(null)}
                className="inline-flex items-center gap-1 text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline"
              >
                <MapPinOff className="size-3.5" aria-hidden />
                Limpar posição
              </button>
            ) : (
              "Sem posição"
            )
          }
          error={errors.mapX?.message ?? errors.mapY?.message}
        >
          {mapUrl ? (
            <CircuitMap
              imageUrl={mapUrl}
              points={others}
              value={hasPos ? { x: mapX, y: mapY } : null}
              onChange={setPos}
              label={name || "Ponto"}
            />
          ) : (
            <NoMapImage />
          )}
        </Field>
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

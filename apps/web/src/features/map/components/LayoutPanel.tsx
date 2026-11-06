import { type Floor, type MapShapeKind, mapShapeKindSchema } from "@arp/contracts";
import { ArrowDownToLine, ArrowUpToLine, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useBlocks } from "@/features/catalog";
import { errorMessage } from "@/shared/api";
import { cn } from "@/shared/lib/cn";
import {
  Button,
  Card,
  CardHeader,
  CountPill,
  Field,
  FieldRow,
  IconButton,
  ImageUpload,
  Input,
  Select,
  toast,
} from "@/shared/ui";
import { useSaveFloor } from "../api";
import { clamp, SHAPE_KIND_LABEL, VIEW_H, VIEW_W } from "./map-canvas";
import type { MapEditor } from "./useMapEditor";

const ROW =
  "flex w-full cursor-pointer items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm transition hover:bg-white/60";

/** Painel do modo "Desenho": planta de fundo, formas do andar, a selecionada e as novas. */
export function LayoutPanel({
  editor,
  floor,
  readOnly,
}: {
  editor: MapEditor;
  floor: Floor;
  readOnly: boolean;
}) {
  const { layout, selection } = editor;
  const [newKind, setNewKind] = useState<MapShapeKind>("block");
  const index = selection?.type === "shape" ? selection.index : -1;
  const shape = layout[index];
  const blocks = useBlocks();
  const usedBlocks = new Set(layout.map((s) => s.blockId).filter(Boolean));
  const saveFloor = useSaveFloor();
  const setBackground = (url: string | null) =>
    saveFloor.mutate(
      { id: floor.id, body: { backgroundImageUrl: url } },
      {
        onSuccess: () =>
          toast.success(
            url ? "Planta do andar salva. Desenhe os blocos por cima." : "Planta tirada.",
          ),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  const num = (key: "x" | "y" | "w" | "h", raw: string) => {
    const n = Number(raw);
    if (raw === "" || !Number.isFinite(n) || !shape) return;
    const max =
      key === "x"
        ? VIEW_W - shape.w
        : key === "y"
          ? VIEW_H - shape.h
          : key === "w"
            ? VIEW_W - shape.x
            : VIEW_H - shape.y;
    editor.updateShape(index, {
      [key]: clamp(Math.round(n), key === "w" || key === "h" ? 1 : 0, max),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {shape && (
        <Card>
          <CardHeader
            title={shape.label || SHAPE_KIND_LABEL[shape.kind]}
            description="Arraste a forma para mover; a alça do canto muda o tamanho."
            action={
              <IconButton
                icon={X}
                label="Fechar"
                size="sm"
                onClick={() => editor.setSelection(null)}
              />
            }
          />
          <fieldset disabled={readOnly} className="flex flex-col gap-4">
            <legend className="sr-only">Forma selecionada</legend>
            <FieldRow>
              <Field label="Tipo">
                <Select
                  value={shape.kind}
                  onChange={(e) =>
                    editor.updateShape(index, { kind: e.target.value as MapShapeKind })
                  }
                >
                  {mapShapeKindSchema.options.map((k) => (
                    <option key={k} value={k}>
                      {SHAPE_KIND_LABEL[k]}
                    </option>
                  ))}
                </Select>
              </Field>
              {shape.kind === "block" ? (
                <Field label="Qual bloco?" hint="O nome no mapa vem do cadastro.">
                  <Select
                    placeholder="Escolha o bloco"
                    value={shape.blockId ?? ""}
                    onChange={(e) => {
                      const b = blocks.data?.find((x) => x.id === e.target.value);
                      editor.updateShape(index, {
                        blockId: b?.id ?? null,
                        ...(b ? { label: b.name.slice(0, 40) } : {}),
                      });
                    }}
                  >
                    {(blocks.data ?? []).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                        {usedBlocks.has(b.id) && b.id !== shape.blockId ? " (já desenhado)" : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
              <Field label="Nome no mapa" hint="Até 40 letras">
                <Input
                  value={shape.label}
                  maxLength={40}
                  onChange={(e) => editor.updateShape(index, { label: e.target.value })}
                />
              </Field>
            </FieldRow>
            <details className="group rounded-2xl bg-neutral-900/[0.03] px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium text-neutral-700">
                Ajuste fino (posição e tamanho exatos)
              </summary>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(["x", "y", "w", "h"] as const).map((k) => (
                  <Field key={k} label={{ x: "X", y: "Y", w: "Largura", h: "Altura" }[k]}>
                    <Input
                      type="number"
                      value={shape[k]}
                      onChange={(e) => num(k, e.target.value)}
                      className="px-2"
                    />
                  </Field>
                ))}
              </div>
            </details>
            {!readOnly && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={ArrowUpToLine}
                  disabled={index === layout.length - 1}
                  onClick={() => editor.moveShape(index, 1)}
                >
                  Para frente
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={ArrowDownToLine}
                  disabled={index === 0}
                  onClick={() => editor.moveShape(index, -1)}
                >
                  Para trás
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  onClick={() => editor.removeShape(index)}
                >
                  Remover
                </Button>
              </div>
            )}
          </fieldset>
        </Card>
      )}

      {!readOnly && !shape && (
        <Card>
          <CardHeader
            title="Planta do andar"
            description="Envie a planta (foto ou imagem do PDF) para desenhar os blocos por cima. Só aparece aqui no painel; o app mostra o desenho."
          />
          <ImageUpload
            label="planta do andar"
            value={floor.backgroundImageUrl}
            onChange={setBackground}
            disabled={saveFloor.isPending}
          />
        </Card>
      )}

      {!readOnly && (
        <Card variant="green">
          <CardHeader
            title="Adicionar forma"
            description="Entra no meio do mapa; depois é só arrastar."
          />
          <div className="flex gap-2">
            <Select
              aria-label="Tipo da forma"
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as MapShapeKind)}
              className="flex-1"
            >
              {mapShapeKindSchema.options.map((k) => (
                <option key={k} value={k}>
                  {SHAPE_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
            <Button icon={Plus} onClick={() => editor.addShape(newKind)}>
              Adicionar
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Formas do andar"
          description="Na ordem de desenho (a última fica por cima)."
          action={<CountPill>{layout.length}</CountPill>}
        />
        {layout.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Andar sem desenho ainda. Adicione blocos, praça, estacionamento…
          </p>
        ) : (
          <ol className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
            {layout.map((s, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: formas sem id; a ordem é a identidade
              <li key={i}>
                <button
                  type="button"
                  aria-pressed={i === index}
                  onClick={() => editor.setSelection({ type: "shape", index: i })}
                  className={cn(
                    ROW,
                    i === index && "bg-neutral-900 text-white hover:bg-neutral-900",
                  )}
                >
                  <span className="w-5 text-xs tabular-nums opacity-60">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{s.label || "(sem nome)"}</span>
                  <span className="text-xs opacity-60">{SHAPE_KIND_LABEL[s.kind]}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

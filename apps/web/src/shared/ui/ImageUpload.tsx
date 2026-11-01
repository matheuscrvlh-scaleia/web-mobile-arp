import { UPLOAD_MAX_BYTES, UPLOAD_MIME_TYPES } from "@arp/contracts";
import { useMutation } from "@tanstack/react-query";
import { ImagePlus, RefreshCw, Trash2 } from "lucide-react";
import { type DragEvent, useId, useRef, useState } from "react";
import { errorMessage, uploadImage } from "@/shared/api";
import { cn } from "@/shared/lib/cn";
import { formatNumber } from "@/shared/lib/format";
import { Button } from "./Button";
import { useFieldControl } from "./Field";
import { Spinner } from "./Spinner";

const ACCEPT = UPLOAD_MIME_TYPES.join(",");
const MAX_MB = formatNumber(UPLOAD_MAX_BYTES / 1024 / 1024);

function validate(file: File): string | null {
  if (!(UPLOAD_MIME_TYPES as readonly string[]).includes(file.type))
    return "Use uma imagem JPG, PNG ou WebP.";
  if (file.size > UPLOAD_MAX_BYTES) return `A imagem passa de ${MAX_MB} MB.`;
  return null;
}

/**
 * Envio de imagem: arraste ou escolha, a prévia aparece na hora e o
 * arquivo vai para /uploads. O campo guarda só a URL devolvida.
 */
export function ImageUpload({
  value,
  onChange,
  label,
  aspect = "cover",
  disabled = false,
}: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  /** Nome do campo (vai para os botões, para leitores de tela). */
  label: string;
  /** cover = 16:9 (capa), square = 1:1 (logo). */
  aspect?: "cover" | "square";
  disabled?: boolean;
}) {
  const ownId = useId();
  // Dentro de um <Field>, o rótulo dele aponta para o seletor de arquivo.
  const a11y = useFieldControl({});
  const inputId = a11y.id ?? ownId;
  const input = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const upload = useMutation({
    mutationFn: (file: File) => uploadImage(file),
    onSuccess: (res) => onChange(res.url),
  });

  const pick = (file: File | undefined) => {
    if (!file) return;
    const err = validate(file);
    setLocalError(err);
    if (!err) upload.mutate(file);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!disabled) pick(e.dataTransfer.files[0]);
  };

  const error = localError ?? (upload.error ? errorMessage(upload.error) : null);
  const busy = upload.isPending;
  const box = aspect === "cover" ? "aspect-[16/9] w-full max-w-md" : "aspect-square w-32";

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={input}
        id={inputId}
        aria-describedby={a11y["aria-describedby"]}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        disabled={disabled || busy}
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {value ? (
        <div className="flex flex-wrap items-end gap-3">
          <div
            className={cn(
              "relative overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100",
              box,
            )}
          >
            <img
              src={value}
              alt={`Prévia: ${label}`}
              decoding="async"
              className="size-full object-cover"
            />
            {busy && (
              <span className="absolute inset-0 grid place-items-center bg-black/40 text-[#fff]">
                <Spinner className="size-6" />
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              disabled={disabled || busy}
              onClick={() => input.current?.click()}
            >
              Trocar<span className="sr-only"> {label}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={Trash2}
              disabled={disabled || busy}
              onClick={() => onChange(null)}
            >
              Remover<span className="sr-only"> {label}</span>
            </Button>
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-300 bg-white/40 p-4 text-center text-sm text-neutral-500 transition hover:border-neutral-500 hover:text-neutral-800",
            box,
            dragging && "border-marca-escuro bg-marca/10 text-neutral-900",
            (disabled || busy) && "cursor-not-allowed opacity-60",
          )}
        >
          {busy ? <Spinner className="size-6" /> : <ImagePlus className="size-6" aria-hidden />}
          <span>
            {busy ? (
              "Enviando…"
            ) : (
              <>
                <span className="font-medium text-neutral-900">Escolher imagem</span>
                {aspect === "cover" && " ou arraste aqui"}
              </>
            )}
          </span>
          <span className="text-[11px] text-neutral-400">JPG, PNG ou WebP até {MAX_MB} MB</span>
        </label>
      )}
      {error && (
        <p role="alert" className="text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

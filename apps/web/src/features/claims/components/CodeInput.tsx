import { Search } from "lucide-react";
import type { Ref } from "react";
import { Button } from "@/shared/ui";
import { CODE_BODY_LENGTH, CODE_PREFIX, normalizeCodeBody } from "../lib/code";
import { QrScanButton } from "./QrScanner";

/**
 * Campo grande do código, pensado para o caixa: "ARP-" já vem escrito,
 * maiúsculas automáticas e colar o código inteiro (ou só as 6 letras)
 * funciona. Enter consulta. Com câmera, "Ler QR" preenche (também no iPhone).
 * No celular o campo ocupa a largura toda e os botões ficam lado a lado embaixo.
 */
export function CodeInput({
  id,
  value,
  onChange,
  inputRef,
  loading,
  describedBy,
  invalid,
}: {
  id: string;
  /** Só as 6 letras/números (sem o "ARP-"). */
  value: string;
  onChange: (body: string) => void;
  inputRef: Ref<HTMLInputElement>;
  loading: boolean;
  describedBy?: string;
  invalid?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
      <div className="flex h-20 w-full min-w-0 shrink-0 items-center sm:w-auto sm:flex-1 rounded-[1.5rem] border-2 border-neutral-200 bg-white transition focus-within:border-neutral-900 focus-within:ring-4 focus-within:ring-neutral-900/5 has-[[aria-invalid=true]]:border-red-500">
        <span
          aria-hidden
          className="pl-5 font-mono text-3xl font-semibold tracking-[0.12em] text-neutral-400 sm:text-4xl"
        >
          {CODE_PREFIX}
        </span>
        <input
          ref={inputRef}
          id={id}
          value={value}
          onChange={(e) => onChange(normalizeCodeBody(e.target.value))}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          enterKeyHint="search"
          placeholder={"X".repeat(CODE_BODY_LENGTH)}
          // biome-ignore lint/a11y/noAutofocus: tela de balcão, o campo é a única tarefa
          autoFocus
          // O foco aparece no quadro arredondado (focus-within); o `!` vence a regra global.
          className="h-full w-full min-w-0 bg-transparent pr-4 font-mono text-3xl font-semibold tracking-[0.12em] text-neutral-900 uppercase outline-none! placeholder:text-neutral-300 sm:text-4xl"
        />
      </div>
      <div className="flex gap-2 sm:gap-3">
        <QrScanButton
          onCode={(text) => onChange(normalizeCodeBody(text))}
          className="h-12 flex-1 sm:h-20 sm:flex-none sm:px-6"
        />
        {/* A consulta já é automática com 6 letras: no celular o botão é menor. */}
        <Button
          type="submit"
          size="lg"
          variant="secondary"
          icon={Search}
          loading={loading}
          className="h-12 flex-1 sm:h-20 sm:flex-none sm:px-7"
        >
          Consultar
        </Button>
      </div>
    </div>
  );
}

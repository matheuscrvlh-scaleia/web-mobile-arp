import { Wand2 } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Button, CopyButton, Field, fieldClass, useFieldControl } from "@/shared/ui";

/** Sem caracteres ambíguos (0/O, 1/l/I), para ditar sem erro. */
const LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";

/** Senha forte de 14 caracteres, gerada no navegador, com letra e número (regra do contrato). */
export function generatePassword(): string {
  const alphabet = LETTERS + DIGITS;
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint32Array(14));
    const password = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
    if (/[A-Za-z]/.test(password) && /\d/.test(password)) return password;
  }
}

/**
 * Senha provisória à vista, com "Gerar" e "Copiar". Fica visível de propósito:
 * quem cria precisa ler e passar para a pessoa, que troca no primeiro acesso.
 */
export function PasswordField({
  value,
  onChange,
  label = "Senha provisória",
  hint = "8 caracteres ou mais, com letra e número. A pessoa troca no primeiro acesso.",
  placeholder,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  hint?: string;
  placeholder?: string;
  error?: string;
}) {
  return (
    <Field label={label} hint={hint} error={error}>
      <div className="flex flex-wrap gap-2">
        <Input value={value} onChange={onChange} placeholder={placeholder} />
        <Button variant="secondary" icon={Wand2} onClick={() => onChange(generatePassword())}>
          Gerar
        </Button>
        {value && <CopyButton value={value} label="Copiar" />}
      </div>
    </Field>
  );
}

function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const a11y = useFieldControl({});
  return (
    <input
      {...a11y}
      type="text"
      autoComplete="off"
      spellCheck={false}
      maxLength={128}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(fieldClass, "h-11 min-w-48 flex-1 font-mono tracking-wide")}
    />
  );
}

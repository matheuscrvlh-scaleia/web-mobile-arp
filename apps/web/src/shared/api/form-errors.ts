import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { isApiError } from "./errors";

/**
 * Leva os erros de campo do VALIDATION_ERROR da API para o formulário.
 * Devolve true se marcou algum campo (a tela não precisa de toast) e false
 * quando o erro não é de campo (a tela mostra a mensagem geral).
 *
 * `fieldMap` traduz o caminho da API para o do formulário quando diferem
 * (ex.: { "hours.0.opensAt": "hours.0.opensAt" } ou { storeId: "store" }).
 */
export function applyApiErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly string[],
  fieldMap: Record<string, string> = {},
): boolean {
  if (!isApiError(error) || !error.isValidation) return false;
  let applied = false;
  let first = true;
  for (const [apiField, messages] of Object.entries(error.fieldErrors)) {
    const field = fieldMap[apiField] ?? apiField;
    const root = field.split(".")[0] ?? field;
    if (!fields.includes(root)) continue;
    setError(field as Path<T>, { type: "server", message: messages[0] }, { shouldFocus: first });
    first = false;
    applied = true;
  }
  return applied;
}

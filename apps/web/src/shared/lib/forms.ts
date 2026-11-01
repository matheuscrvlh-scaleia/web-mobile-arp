/**
 * Só os campos que a pessoa mexeu (para PATCH): edição concorrente de outro
 * campo por outra pessoa não é sobrescrita, e o histórico fica limpo.
 */
export function pickDirty<T extends Record<string, unknown>>(
  values: T,
  dirtyFields: Partial<Record<keyof T, unknown>>,
): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(dirtyFields) as (keyof T)[]) {
    if (dirtyFields[key]) out[key] = values[key];
  }
  return out;
}

/** Entrada das mutations de "salvar" (criar ou editar o mesmo cadastro). */
export type SaveInput<Create, Update> = { id: string; body: Update } | { body: Create };

/** Criar manda o formulário inteiro; editar (com id) manda só o que mudou. */
export function saveInput<T extends Record<string, unknown>>(
  id: string | undefined,
  values: T,
  dirtyFields: Partial<Record<keyof T, unknown>>,
): SaveInput<T, Partial<T>> {
  return id ? { id, body: pickDirty(values, dirtyFields) } : { body: values };
}

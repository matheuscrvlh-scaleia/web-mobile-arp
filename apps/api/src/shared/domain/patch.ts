/**
 * PATCH parcial: só os campos presentes mudam. `undefined` = mantém o valor
 * atual; `null` = limpa. O contrato monta os PATCH com `patchOf` (sem os
 * defaults do create), então campo ausente nunca sobrescreve nada.
 */
export function definedFields<T extends object>(changes: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(changes).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

/** Estado atual com as mudanças presentes aplicadas (objeto novo). */
export function applyPatch<S extends object>(current: S, changes: Partial<NoInfer<S>>): S {
  return { ...current, ...definedFields(changes) };
}

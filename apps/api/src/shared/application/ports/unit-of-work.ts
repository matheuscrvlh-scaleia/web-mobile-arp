/**
 * Transação. Repositórios e AuditLogger chamados dentro de run() usam a
 * mesma transação sem receber parâmetro (AsyncLocalStorage no adaptador).
 * Aninhar vira savepoint.
 */
export interface UnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T>;
}

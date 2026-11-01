import { AsyncLocalStorage } from "node:async_hooks";

/** Dados da requisição em andamento, visíveis em qualquer ponto da chamada (logs do banco). */
export interface RequestContext {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Roda fn (e tudo que ela disparar) com o contexto da requisição. */
export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** Campos para os logs; undefined fora de uma requisição (jobs, CLI). */
export function requestLogContext(): Record<string, unknown> | undefined {
  const context = storage.getStore();
  return context ? { requestId: context.requestId } : undefined;
}

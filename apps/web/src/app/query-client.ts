import { MutationCache, QueryClient } from "@tanstack/react-query";
import { isApiError, isNetworkError, OFFLINE_SAVE_MESSAGE } from "@/shared/api";
import { toast } from "@/shared/ui";

/** Erro de quem pediu (4xx) não melhora repetindo; rede e 5xx tentam mais 2 vezes. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
  if (isApiError(error) && error.code === "BAD_RESPONSE") return false;
  return failureCount < 2;
}

/** Mesma chave do usePending (features/dashboard). */
const PENDING_KEY = ["pending"] as const;

export function createQueryClient() {
  const client: QueryClient = new QueryClient({
    // Sem rede ao salvar: um aviso só (o mesmo texto que a tela mostraria
    // substitui este, sem empilhar) e o formulário continua preenchido.
    mutationCache: new MutationCache({
      onError: (error) => {
        if (isNetworkError(error)) toast.error(OFFLINE_SAVE_MESSAGE);
      },
      // Qualquer gravação pode resolver (ou criar) uma pendência: o contador
      // do menu e o sino se atualizam na hora, sem esperar o minuto.
      onSuccess: () => {
        void client.invalidateQueries({ queryKey: PENDING_KEY });
      },
    }),
    defaultOptions: {
      queries: {
        // Painel de gestão: 30 s de dado "fresco" evita refetch a cada troca de tela.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetry,
        refetchOnWindowFocus: true,
      },
      // "always": sem rede, falha na hora em vez de ficar girando e enviar
      // sozinho quando a internet volta (criava duplicado sem ninguém ver).
      mutations: { retry: false, networkMode: "always" },
    },
  });
  return client;
}

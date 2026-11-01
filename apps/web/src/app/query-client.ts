import { QueryClient } from "@tanstack/react-query";
import { isApiError } from "@/shared/api";

/** Erro de quem pediu (4xx) não melhora repetindo; rede e 5xx tentam mais 2 vezes. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
  if (isApiError(error) && error.code === "BAD_RESPONSE") return false;
  return failureCount < 2;
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Painel de gestão: 30 s de dado "fresco" evita refetch a cada troca de tela.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetry,
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  });
}

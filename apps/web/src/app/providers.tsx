import { QueryClientProvider } from "@tanstack/react-query";
import { lazy, type ReactNode, Suspense, useState } from "react";
import { AuthProvider } from "@/shared/auth";
import { useIsMobile } from "@/shared/hooks";
import { ThemeProvider } from "@/shared/theme/ThemeProvider";
import { ConfirmHost, Toaster } from "@/shared/ui";
import { createQueryClient } from "./query-client";

// Devtools só em desenvolvimento (fora do pacote de produção) e só no
// computador: no celular o botão flutuante cobria botões da tela.
const Devtools = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/react-query-devtools").then((m) => ({ default: m.ReactQueryDevtools })),
    )
  : () => null;

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  const mobile = useIsMobile();
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {children}
          <Toaster />
          <ConfirmHost />
        </AuthProvider>
        {!mobile && (
          <Suspense>
            <Devtools buttonPosition="bottom-left" />
          </Suspense>
        )}
      </QueryClientProvider>
    </ThemeProvider>
  );
}

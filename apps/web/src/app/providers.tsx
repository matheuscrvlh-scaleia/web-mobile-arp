import { QueryClientProvider } from "@tanstack/react-query";
import { lazy, type ReactNode, Suspense, useState } from "react";
import { AuthProvider } from "@/shared/auth";
import { ThemeProvider } from "@/shared/theme/ThemeProvider";
import { ConfirmHost, Toaster } from "@/shared/ui";
import { createQueryClient } from "./query-client";

// Devtools só em desenvolvimento (fora do pacote de produção).
const Devtools = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/react-query-devtools").then((m) => ({ default: m.ReactQueryDevtools })),
    )
  : () => null;

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {children}
          <Toaster />
          <ConfirmHost />
        </AuthProvider>
        <Suspense>
          <Devtools buttonPosition="bottom-left" />
        </Suspense>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

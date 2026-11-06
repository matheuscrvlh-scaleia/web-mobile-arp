import "@fontsource-variable/geist";
import "./styles/globals.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { config as zodConfig } from "zod";
import { ptBR } from "zod/locales";
import { AppProviders } from "./app/providers";
import { router } from "./app/router";
import { startVersionCheck } from "./shared/ui";

// Mensagens de validação do Zod em português (as mesmas da API).
zodConfig(ptBR());
// Deploy novo no ar: aviso no canto para atualizar.
startVersionCheck();

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root não encontrado no index.html");

createRoot(root).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);

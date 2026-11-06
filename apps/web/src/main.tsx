import "@fontsource-variable/geist";
import "./styles/globals.css";
import { configureZodMessages } from "@arp/contracts";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { AppProviders } from "./app/providers";
import { router } from "./app/router";
import { startVersionCheck } from "./shared/ui";

// Mensagens de validação em português de gente (as mesmas da API):
// "Obrigatório", "Escreva pelo menos 3 letras", "Escolha uma opção"…
configureZodMessages();
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

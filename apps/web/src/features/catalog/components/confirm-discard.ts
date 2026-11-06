import { confirmar } from "@/shared/ui";

/** Fechar a janela com algo digitado: pergunta antes de jogar fora. */
export const confirmDiscard = () =>
  confirmar({
    title: "Descartar o que foi digitado?",
    description: "Se fechar agora, as alterações desta janela se perdem.",
    confirmLabel: "Descartar",
    cancelLabel: "Continuar editando",
    danger: true,
  });

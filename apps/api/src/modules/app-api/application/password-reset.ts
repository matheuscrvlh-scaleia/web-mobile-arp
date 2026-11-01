import type { MailMessage } from "../../../shared/application/ports/mailer";

/** Hash com segredo do código de recuperação (o banco não guarda o código). */
export interface ResetCodeHasher {
  hash(visitorId: string, code: string): string;
  /** Comparação em tempo constante. */
  matches(visitorId: string, code: string, hash: string): boolean;
}

export const RESET_CODE_LENGTH = 6;
/** Tentativas erradas por código; depois disso ele deixa de valer. */
export const RESET_MAX_ATTEMPTS = 5;
export const INVALID_RESET_CODE_MESSAGE = "Código inválido ou vencido";
export const RESET_UNAVAILABLE_MESSAGE =
  "A recuperação de senha está indisponível no momento. Tente mais tarde ou fale com o atendimento da ARP.";

/** E-mail com o código (texto simples + HTML mínimo). */
export function passwordResetEmail(input: {
  to: string;
  name: string;
  code: string;
  ttlMinutes: number;
}): MailMessage {
  const firstName = input.name.trim().split(/\s+/)[0] ?? "";
  const greeting = firstName ? `Olá, ${firstName}!` : "Olá!";
  const lines = [
    greeting,
    "",
    "Recebemos um pedido para criar uma nova senha na sua conta do app ARP.",
    `Seu código é: ${input.code}`,
    "",
    `Digite o código no app. Ele vale por ${input.ttlMinutes} minutos e só pode ser usado uma vez.`,
    "Se não foi você, ignore este e-mail: sua senha continua a mesma.",
  ];
  const html = [
    `<p>${escapeHtml(greeting)}</p>`,
    "<p>Recebemos um pedido para criar uma nova senha na sua conta do app ARP.</p>",
    `<p>Seu código é:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${input.code}</p>`,
    `<p>Digite o código no app. Ele vale por ${input.ttlMinutes} minutos e só pode ser usado uma vez.</p>`,
    "<p>Se não foi você, ignore este e-mail: sua senha continua a mesma.</p>",
  ].join("\n");
  return {
    to: input.to,
    subject: `${input.code} é o seu código para criar uma nova senha`,
    text: lines.join("\n"),
    html,
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

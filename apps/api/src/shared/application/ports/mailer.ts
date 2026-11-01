export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Envio de e-mail transacional (ex.: código de recuperação de senha). */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

import nodemailer from "nodemailer";
import type { Mailer, MailMessage } from "../../application/ports/mailer";

interface InfoLogger {
  info(obj: object, msg?: string): void;
}

/**
 * Dev: o e-mail vai para o log (com o texto, para ver o código de
 * recuperação). Só este driver escreve o conteúdo no log.
 */
export class LogMailer implements Mailer {
  constructor(private readonly logger: InfoLogger) {}

  async send(message: MailMessage): Promise<void> {
    this.logger.info(
      { to: message.to, subject: message.subject, text: message.text },
      "E-mail enviado (driver de log)",
    );
  }
}

export interface SmtpMailerOptions {
  /** smtp://usuario:senha@host:587 ou smtps://...:465. Tem prioridade sobre host/porta. */
  url?: string;
  host?: string;
  port: number;
  /** TLS direto (465). Sem valor: ligado só na porta 465 (as outras usam STARTTLS). */
  secure?: boolean;
  user?: string;
  password?: string;
  from: string;
}

/** SMTP via nodemailer, com timeouts curtos (a requisição espera o envio). */
export class SmtpMailer implements Mailer {
  private readonly transport: ReturnType<typeof nodemailer.createTransport>;

  constructor(private readonly options: SmtpMailerOptions) {
    this.transport = nodemailer.createTransport({
      ...(options.url
        ? { url: options.url }
        : {
            host: options.host,
            port: options.port,
            secure: options.secure ?? options.port === 465,
          }),
      ...(options.user ? { auth: { user: options.user, pass: options.password ?? "" } } : {}),
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.options.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
    });
  }
}

export interface MailEnv {
  NODE_ENV: "development" | "test" | "production";
  MAIL_DRIVER?: "log" | "smtp" | undefined;
  MAIL_FROM?: string | undefined;
  SMTP_URL?: string | undefined;
  SMTP_HOST?: string | undefined;
  SMTP_PORT: number;
  SMTP_SECURE?: boolean | undefined;
  SMTP_USER?: string | undefined;
  SMTP_PASSWORD?: string | undefined;
}

/**
 * Driver pelo MAIL_DRIVER; sem valor, log fora de produção. Em produção sem
 * driver devolve null: quem depende de e-mail responde 503 em vez de fingir
 * que enviou.
 */
export function createMailer(env: MailEnv, logger: InfoLogger): Mailer | null {
  const driver = env.MAIL_DRIVER ?? (env.NODE_ENV === "production" ? null : "log");
  if (driver === "log") return new LogMailer(logger);
  if (driver === "smtp") {
    if (!env.MAIL_FROM || !(env.SMTP_URL || env.SMTP_HOST)) {
      throw new Error("MAIL_DRIVER=smtp exige MAIL_FROM e SMTP_URL (ou SMTP_HOST)");
    }
    return new SmtpMailer({
      ...(env.SMTP_URL ? { url: env.SMTP_URL } : {}),
      ...(env.SMTP_HOST ? { host: env.SMTP_HOST } : {}),
      port: env.SMTP_PORT,
      ...(env.SMTP_SECURE === undefined ? {} : { secure: env.SMTP_SECURE }),
      ...(env.SMTP_USER ? { user: env.SMTP_USER } : {}),
      ...(env.SMTP_PASSWORD ? { password: env.SMTP_PASSWORD } : {}),
      from: env.MAIL_FROM,
    });
  }
  return null;
}

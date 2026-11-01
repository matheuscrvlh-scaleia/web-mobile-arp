import type { Clock } from "../application/ports/clock";
import type { PushMessage, PushResult, PushSender } from "../application/ports/push-sender";
import type { UnitOfWork } from "../application/ports/unit-of-work";
import type { Database } from "./database/database";

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class DatabaseUnitOfWork implements UnitOfWork {
  constructor(private readonly db: Database) {}

  run<T>(work: () => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }
}

interface InfoLogger {
  info(obj: object, msg?: string): void;
}

/** Até integrar o Expo Push: registra o envio no log (sem o token completo). */
export class LogPushSender implements PushSender {
  constructor(private readonly logger: InfoLogger) {}

  async send(messages: PushMessage[]): Promise<PushResult> {
    const sample = messages[0];
    if (sample) {
      this.logger.info(
        { count: messages.length, title: sample.title, sampleTo: `${sample.to.slice(0, 18)}...` },
        "Push enviado (adaptador de log)",
      );
    }
    return { sent: messages.length, failed: 0 };
  }
}

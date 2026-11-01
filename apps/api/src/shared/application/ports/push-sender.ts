export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushResult {
  sent: number;
  failed: number;
}

/** Envio de push (Expo). O adaptador atual só registra em log. */
export interface PushSender {
  send(messages: PushMessage[]): Promise<PushResult>;
}

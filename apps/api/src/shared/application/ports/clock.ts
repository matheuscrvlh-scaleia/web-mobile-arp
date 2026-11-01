/** Relógio injetável: casos de uso nunca chamam new Date() direto (testes controlam o tempo). */
export interface Clock {
  now(): Date;
}

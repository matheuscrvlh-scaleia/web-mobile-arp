/**
 * Conversões entre o formato do banco/domínio e o do fio (contrato). Usadas
 * pelas query services (linha → DTO) e pelas rotas (corpo → entrada do caso de uso).
 */

export function iso(date: Date): string {
  return date.toISOString();
}

export function isoOrNull(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

/** Coluna `time` ("HH:MM:SS") → "HH:mm". */
export function hhmmOrNull(time: string | null | undefined): string | null {
  return time ? time.slice(0, 5) : null;
}

/** Data ISO do corpo → Date (null/undefined preservados para PATCH parcial). */
export function toDate(value: string): Date;
export function toDate(value: string | null): Date | null;
export function toDate(value: string | undefined): Date | undefined;
export function toDate(value: string | null | undefined): Date | null | undefined;
export function toDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
}

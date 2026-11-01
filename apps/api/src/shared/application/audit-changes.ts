/**
 * Monta o `changes` da auditoria: snapshot na criação e { campo: { from, to } }
 * na edição. Campos sensíveis nunca entram (nem o nome do campo com valor).
 */

const SENSITIVE_KEY = /password|hash|token|secret/i;

export type AuditValue = string | number | boolean | null | AuditValue[] | AuditRecord;
export interface AuditRecord {
  [key: string]: AuditValue;
}

function normalize(value: unknown): AuditValue {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Set) return [...value].map(normalize);
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object") {
    const out: AuditRecord = {};
    for (const [k, v] of Object.entries(value)) {
      if (!SENSITIVE_KEY.test(k)) out[k] = normalize(v);
    }
    return out;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return String(value);
}

/** Cópia do estado criado, sem campos sensíveis. */
export function snapshot(state: object): AuditRecord {
  return normalize(state) as AuditRecord;
}

/** Só os campos que mudaram. Vazio = nada mudou (a escrita pode ser pulada). */
export function diff(
  before: object,
  after: object,
): Record<string, { from: AuditValue; to: AuditValue }> {
  const changes: Record<string, { from: AuditValue; to: AuditValue }> = {};
  const a = before as Record<string, unknown>;
  const b = after as Record<string, unknown>;
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (SENSITIVE_KEY.test(key)) continue;
    const from = normalize(a[key]);
    const to = normalize(b[key]);
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[key] = { from, to };
  }
  return changes;
}

export function hasChanges(changes: object): boolean {
  return Object.keys(changes).length > 0;
}

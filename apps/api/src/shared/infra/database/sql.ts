/**
 * Template tag para SQL parametrizado, sem ORM.
 *
 *   const q = sql`select id from directory.stores where slug = ${slug}`;
 *   q.text   // "select id from directory.stores where slug = $1"
 *   q.values // [slug]
 *
 * Todo valor interpolado vira parâmetro ($1..$n), exceto outro fragmento
 * `sql`, que é embutido (com os parâmetros renumerados). Assim filtros
 * opcionais são montados por composição, nunca por concatenação de string.
 */

const FRAGMENT = Symbol.for("arp.sql.fragment");

export class SqlFragment {
  readonly [FRAGMENT] = true;

  /** Pedaços de texto; sempre strings.length === values.length + 1. */
  readonly strings: readonly string[];
  readonly values: readonly unknown[];

  constructor(strings: readonly string[], values: readonly unknown[]) {
    // Achata fragmentos aninhados já na construção: renderizar fica linear.
    const outStrings: string[] = [strings[0] ?? ""];
    const outValues: unknown[] = [];

    values.forEach((value, i) => {
      const next = strings[i + 1] ?? "";
      if (isSqlFragment(value)) {
        const inner = value.strings;
        outStrings[outStrings.length - 1] += inner[0] ?? "";
        for (let j = 0; j < value.values.length; j++) {
          outValues.push(value.values[j]);
          outStrings.push(inner[j + 1] ?? "");
        }
        outStrings[outStrings.length - 1] += next;
      } else {
        if (value === undefined) {
          // undefined quase sempre é campo esquecido; o pg trataria como NULL
          // em silêncio. Quem quer NULL passa null.
          throw new TypeError(
            `sql: valor undefined no parâmetro ${outValues.length + 1}. Use null para NULL.`,
          );
        }
        outValues.push(value);
        outStrings.push(next);
      }
    });

    this.strings = outStrings;
    this.values = outValues;
  }

  /** Texto com placeholders $1..$n (formato do node-postgres). */
  get text(): string {
    let text = this.strings[0] ?? "";
    for (let i = 1; i < this.strings.length; i++) {
      text += `$${i}${this.strings[i]}`;
    }
    return text;
  }

  /** Objeto aceito por pg.Client#query. */
  toQuery(): { text: string; values: unknown[] } {
    return { text: this.text, values: [...this.values] };
  }

  /** Útil em logs: nunca inclui os valores (podem ser dados pessoais). */
  toString(): string {
    return this.text;
  }
}

export function isSqlFragment(value: unknown): value is SqlFragment {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<symbol, unknown>)[FRAGMENT] === true
  );
}

type Condition = SqlFragment | false | null | undefined | "" | 0;

function sqlTag(strings: TemplateStringsArray, ...values: unknown[]): SqlFragment {
  return new SqlFragment(strings, values);
}

/** Texto confiável do código, inserido como está. NUNCA use com entrada do usuário. */
function raw(text: string): SqlFragment {
  return new SqlFragment([text], []);
}

const empty = raw("");

/**
 * Nome de schema/tabela/coluna escapado com aspas duplas. Aceita "schema.tabela"
 * ou várias partes. Serve para trechos dinâmicos vindos do código (ex.: coluna
 * de ordenação escolhida numa lista fechada).
 */
function identifier(...parts: string[]): SqlFragment {
  const names = parts.flatMap((p) => p.split("."));
  if (names.length === 0 || names.some((n) => n.length === 0)) {
    throw new TypeError("sql.identifier: nome vazio");
  }
  return raw(names.map((n) => `"${n.replaceAll('"', '""')}"`).join("."));
}

/**
 * Junta itens com um separador. Itens que não são fragmentos viram parâmetros
 * (ex.: sql.join([1, 2, 3]) → "$1, $2, $3").
 */
function join(items: readonly unknown[], separator: SqlFragment | string = ", "): SqlFragment {
  if (items.length === 0) return empty;
  const sep = typeof separator === "string" ? raw(separator) : separator;
  const strings: string[] = [""];
  const values: unknown[] = [];
  items.forEach((item, i) => {
    if (i > 0) {
      values.push(sep);
      strings.push("");
    }
    values.push(item);
    strings.push("");
  });
  return new SqlFragment(strings, values);
}

/** Condições unidas por AND, ignorando as falsas. Sem nenhuma: "true". */
function and(conditions: readonly Condition[]): SqlFragment {
  const list = conditions.filter(isSqlFragment);
  if (list.length === 0) return raw("true");
  if (list.length === 1) return list[0] as SqlFragment;
  return sqlTag`(${join(list, ") and (")})`;
}

/** Condições unidas por OR, ignorando as falsas. Sem nenhuma: "false". */
function or(conditions: readonly Condition[]): SqlFragment {
  const list = conditions.filter(isSqlFragment);
  if (list.length === 0) return raw("false");
  if (list.length === 1) return list[0] as SqlFragment;
  return sqlTag`(${join(list, ") or (")})`;
}

/**
 * "where a and b" com as condições verdadeiras, ou nada se não houver.
 * Feito para filtros opcionais de listagem:
 *
 *   sql`select … from directory.stores s ${sql.where([
 *     status && sql`s.status = ${status}`,
 *     q && sql`public.f_unaccent(lower(s.name)) like ${sql.containsPattern(q)}`,
 *   ])}`
 */
function where(conditions: readonly Condition[]): SqlFragment {
  const list = conditions.filter(isSqlFragment);
  if (list.length === 0) return empty;
  return sqlTag` where ${and(list)}`;
}

/**
 * Padrão LIKE "contém" para busca sem acento, já com os curingas do usuário
 * escapados. Use com a MESMA expressão dos índices trigram:
 *   public.f_unaccent(lower(coluna)) like ${sql.containsPattern(q)}
 */
function containsPattern(term: string): SqlFragment {
  return sqlTag`'%' || public.f_unaccent(${escapeLike(term.toLowerCase())}) || '%'`;
}

/** Escapa os curingas do LIKE (%, _ e \) para o texto casar literalmente. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export const sql = Object.assign(sqlTag, {
  raw,
  empty,
  identifier,
  join,
  and,
  or,
  where,
  containsPattern,
});

export type Sql = typeof sql;

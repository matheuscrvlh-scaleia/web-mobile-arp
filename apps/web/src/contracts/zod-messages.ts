import { z } from "zod";
import { ptBR } from "zod/locales";

// Mensagens de validação em português de gente, iguais no painel e na API
// (a API devolve estas mesmas frases nos erros de campo). Mensagem escrita
// no próprio schema (`{ error: "Escolha a categoria" }`) sempre vale mais.
// O que não está aqui cai no locale pt-BR do Zod.

type Issue = Parameters<NonNullable<z.core.$ZodConfig["customError"]>>[0];

const num = (n: unknown) =>
  typeof n === "number" || typeof n === "bigint" ? n.toLocaleString("pt-BR") : String(n);

const day = (d: unknown) => {
  const date = d instanceof Date ? d : new Date(Number(d));
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("pt-BR");
};

/** O schema que gerou o erro é um id (uuid)? Então é um select/escolha. */
function isIdSchema(iss: Issue): boolean {
  const def = (iss.inst as { _zod?: { def?: { format?: string } } } | undefined)?._zod?.def;
  return def?.format === "uuid" || def?.format === "guid";
}

const empty = (v: unknown) => v === undefined || v === null || v === "";

/** `customError` global do Zod 4: devolve a frase ou undefined (usa o locale). */
export function zodMessage(iss: Issue): string | undefined {
  switch (iss.code) {
    case "invalid_type": {
      if (empty(iss.input)) return isIdSchema(iss) ? "Escolha uma opção" : "Obrigatório";
      if (iss.expected === "date") return "Data inválida";
      if (iss.expected === "int") return "Use um número inteiro";
      if (iss.expected === "number") return "Use um número";
      return undefined;
    }
    case "too_small": {
      const min = iss.minimum;
      const n = Number(min);
      if (iss.origin === "string") {
        if (empty(iss.input) || n <= 1) return "Obrigatório";
        return `Escreva pelo menos ${num(min)} letras`;
      }
      if (iss.origin === "number" || iss.origin === "int" || iss.origin === "bigint") {
        if (iss.input === undefined || Number.isNaN(iss.input)) return "Obrigatório";
        return iss.inclusive === false
          ? `Use um valor maior que ${num(min)}`
          : `Use pelo menos ${num(min)}`;
      }
      if (iss.origin === "array" || iss.origin === "set") {
        return n <= 1 ? "Escolha pelo menos uma opção" : `Escolha pelo menos ${num(min)}`;
      }
      if (iss.origin === "date") return `Use uma data a partir de ${day(min)}`;
      return undefined;
    }
    case "too_big": {
      const max = iss.maximum;
      if (iss.origin === "string") return `Use no máximo ${num(max)} caracteres`;
      if (iss.origin === "number" || iss.origin === "int" || iss.origin === "bigint") {
        return iss.inclusive === false
          ? `Use um valor menor que ${num(max)}`
          : `Use no máximo ${num(max)}`;
      }
      if (iss.origin === "array" || iss.origin === "set") return `Escolha no máximo ${num(max)}`;
      if (iss.origin === "date") return `Use uma data até ${day(max)}`;
      return undefined;
    }
    case "invalid_format": {
      if (iss.format === "uuid" || iss.format === "guid") return "Escolha uma opção";
      if (empty(iss.input)) return "Obrigatório";
      if (iss.format === "url") return "Use um link válido (https://…)";
      if (iss.format === "email") return "E-mail inválido";
      if (iss.format === "datetime" || iss.format === "date") return "Data inválida";
      if (iss.format === "time") return "Horário inválido";
      if (iss.format === "regex") return "Formato inválido";
      return undefined;
    }
    case "invalid_value":
      return "Escolha uma opção";
    default:
      return undefined;
  }
}

/** Liga as mensagens (locale pt-BR + as nossas). Chamar uma vez na subida. */
export function configureZodMessages() {
  z.config(ptBR());
  z.config({ customError: zodMessage });
}

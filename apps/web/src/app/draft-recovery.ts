import { onSessionEvent } from "@/shared/api";
import { hasUnsavedChanges } from "@/shared/hooks";

/*
 * Rascunho do formulário quando a sessão expira (GER-18), de forma genérica:
 * no instante em que a sessão cai com uma tela "suja", copia os campos com
 * `name` dos formulários da tela para o sessionStorage (chave = rota). Depois
 * do login, de volta à mesma rota, a tela é preenchida de novo.
 *
 * Campos nativos com `name` (o que o register do React Hook Form gera) e,
 * pelo rótulo, caixas de marcar sem `name` e switches (R2G-07: permissões do
 * cargo, "ativo"). Atalho: combobox, imagem e cor não voltam.
 * Senhas e arquivos nunca são guardados.
 */

const KEY = "arp-rascunho";
/** Rascunho mais velho que isso é descartado (a pessoa pode ter desistido). */
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

type Field = { name: string; value: string; checked?: boolean };
type Draft = { path: string; at: number; fields: Field[] };

const SKIP_TYPES = new Set(["password", "file", "hidden", "submit", "button", "reset"]);

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement;

const isToggle = (el: Control) =>
  el instanceof HTMLButtonElement ||
  (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio"));

/** Chave do campo: o `name`, ou o rótulo (caixas sem name e switches). */
function keyOf(el: Control): string {
  if (!(el instanceof HTMLButtonElement) && el.name) return el.name;
  const text =
    el.getAttribute("aria-label") ??
    (el instanceof HTMLButtonElement ? null : el.labels?.[0]?.textContent) ??
    el.closest("label")?.textContent ??
    "";
  return `@${text.replace(/s+/g, " ").trim()}`;
}

function formFields(): Control[] {
  return Array.from(
    document.querySelectorAll<Control>(
      "main form input[name], main form textarea[name], main form select[name], main form input[type=checkbox]:not([name]), main form button[role=switch]",
    ),
  ).filter(
    (el) =>
      !(el instanceof HTMLInputElement && SKIP_TYPES.has(el.type)) &&
      !el.disabled &&
      keyOf(el) !== "@",
  );
}

const checkedOf = (el: Control) =>
  el instanceof HTMLButtonElement
    ? el.getAttribute("aria-checked") === "true"
    : el instanceof HTMLInputElement && el.checked;

function read(): Draft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Draft;
    if (!draft || typeof draft.path !== "string" || !Array.isArray(draft.fields)) return null;
    if (Date.now() - draft.at > MAX_AGE_MS) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

function save() {
  const fields: Field[] = formFields().map((el) =>
    isToggle(el)
      ? { name: keyOf(el), value: el.value, checked: checkedOf(el) }
      : { name: keyOf(el), value: el.value },
  );
  if (fields.length === 0) return;
  try {
    const path = `${window.location.pathname}${window.location.search}`;
    sessionStorage.setItem(KEY, JSON.stringify({ path, at: Date.now(), fields } satisfies Draft));
  } catch {
    // Sem armazenamento: perde o rascunho, como antes.
  }
}

let installed = false;
/** Há gravação em andamento? (o cliente de queries atual; troca se ele for recriado) */
let savingNow: () => boolean = () => false;

/**
 * Guarda o rascunho quando a sessão expira com alterações não salvas, ou no
 * meio de uma gravação (as telas deixam de contar como "sujas" enquanto
 * salvam, e é justamente aí que a sessão vencida aparece). Chame cedo, no
 * carregamento do módulo: o AuthProvider limpa o cache de queries no mesmo
 * evento, e este ouvinte precisa rodar antes dele.
 */
export function installDraftCapture(saving?: () => boolean) {
  if (saving) savingNow = saving;
  if (installed) return;
  installed = true;
  onSessionEvent((event) => {
    if (event.type === "expired" && (hasUnsavedChanges() || savingNow())) save();
  });
}

/**
 * Valor novo pelo setter nativo + evento, para o React (e o RHF) perceberem.
 * Devolve true se mudou algo.
 */
function setNative(el: Control, f: Field): boolean {
  if (isToggle(el)) {
    if (el instanceof HTMLInputElement && el.type === "radio" && el.value !== f.value) return false;
    if (checkedOf(el) === Boolean(f.checked)) return false;
    el.click();
    return true;
  }
  if (el instanceof HTMLButtonElement) return false;
  if (el.value === f.value) return false;
  const proto = Object.getPrototypeOf(el) as object;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, f.value);
  el.dispatchEvent(
    new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }),
  );
  return true;
}

/**
 * Na rota do rascunho, espera o formulário aparecer (telas de edição
 * carregam os dados antes) e devolve os valores. Devolve true se restaurou.
 */
export function restoreDraftFor(path: string, signal: AbortSignal): Promise<boolean> {
  const draft = read();
  if (!draft || draft.path !== path) return Promise.resolve(false);
  return new Promise((resolve) => {
    let lastCount = -1;
    let stable = 0;
    let tries = 0;
    const tick = () => {
      if (signal.aborted) return resolve(false);
      const count = formFields().length;
      // Espera a contagem de campos parar de mudar (dados carregados e form montado).
      stable = count > 0 && count === lastCount ? stable + 1 : 0;
      lastCount = count;
      if (stable >= 3) {
        const byName = new Map<string, Field[]>();
        for (const f of draft.fields) byName.set(f.name, [...(byName.get(f.name) ?? []), f]);
        let changed = false;
        for (const el of formFields()) {
          for (const f of byName.get(keyOf(el)) ?? []) changed = setNative(el, f) || changed;
        }
        try {
          sessionStorage.removeItem(KEY);
        } catch {
          // ignora
        }
        // Rascunho igual ao que a tela já mostra não vira aviso.
        return resolve(changed);
      }
      if (++tries > 40) return resolve(false);
      setTimeout(tick, 250);
    };
    setTimeout(tick, 250);
  });
}

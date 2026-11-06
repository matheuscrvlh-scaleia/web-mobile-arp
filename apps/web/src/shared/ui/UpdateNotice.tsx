import { RefreshCw, X } from "lucide-react";
import { useSyncExternalStore } from "react";
import { hasUnsavedChanges, reloadPage } from "@/shared/hooks";
import { Button } from "./Button";
import { confirmar } from "./confirm";

// Versão nova do painel no ar: aviso fixo no canto inferior direito (junto
// dos outros avisos) com "Atualizar" ou "Agora não". Descobre o deploy novo
// relendo o index.html de tempos em tempos e quando a aba volta ao foco, ou
// quando uma tela não baixa porque os arquivos antigos saíram do servidor.

const CHECK_EVERY_MS = 5 * 60_000;

let visible = false;
const listeners = new Set<() => void>();

function setVisible(next: boolean) {
  visible = next;
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Mostra o aviso de versão nova (de novo, se a pessoa tinha dispensado). */
export function avisarVersaoNova() {
  setVisible(true);
}

/** Script principal do index.html (o nome muda a cada deploy). */
function entryScript(html: string): string | null {
  return /<script[^>]*type="module"[^>]*src="([^"]+)"/.exec(html)?.[1] ?? null;
}

/** Liga a checagem de versão (só no build de produção). Chamar uma vez. */
export function startVersionCheck() {
  if (import.meta.env.DEV) return;
  const current = entryScript(document.documentElement.outerHTML);
  if (!current) return;
  let found = false;

  const check = async () => {
    if (found || document.visibilityState !== "visible") return;
    try {
      const res = await fetch("/", { cache: "no-store", headers: { Accept: "text/html" } });
      if (!res.ok) return;
      const latest = entryScript(await res.text());
      if (latest && latest !== current) {
        found = true;
        avisarVersaoNova();
      }
    } catch {
      // Sem rede: tenta de novo na próxima volta.
    }
  };

  setInterval(check, CHECK_EVERY_MS);
  document.addEventListener("visibilitychange", check);
  // Tela que não baixou: os arquivos dela já são de outra versão.
  // Sem rede não é versão nova: quem fala é a faixa "Sem conexão".
  window.addEventListener("vite:preloadError", () => {
    if (navigator.onLine) avisarVersaoNova();
  });
}

async function update() {
  if (
    hasUnsavedChanges() &&
    !(await confirmar({
      title: "Atualizar sem salvar?",
      description: "Há alterações não salvas nesta tela. Se atualizar agora, elas se perdem.",
      confirmLabel: "Atualizar sem salvar",
      cancelLabel: "Continuar editando",
      danger: true,
    }))
  )
    return;
  reloadPage();
}

/** O cartão do aviso. Fica dentro do <Toaster />. */
export function UpdateNotice() {
  const show = useSyncExternalStore(
    subscribe,
    () => visible,
    () => false,
  );
  if (!show) return null;
  return (
    <div className="aviso-entrar vidro pointer-events-auto relative flex items-start gap-3 rounded-2xl p-3 pr-10 shadow-[0_24px_48px_-24px_rgb(0_0_0/0.35)]">
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-sky-400/20 text-sky-700">
        <RefreshCw className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 pt-1">
        <p className="text-sm font-medium leading-snug text-neutral-900">
          Saiu uma versão nova do painel
        </p>
        <p className="mt-0.5 text-sm leading-snug text-neutral-600">
          Atualize para usar a versão mais recente.
        </p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" icon={RefreshCw} onClick={() => void update()}>
            Atualizar
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setVisible(false)}>
            Agora não
          </Button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Fechar aviso"
        className="absolute top-2 right-2 grid size-7 cursor-pointer place-items-center rounded-full text-neutral-500 transition hover:bg-neutral-900/[0.07] hover:text-neutral-900"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

import { KeyRound, Link2, Megaphone, PlugZap, Save, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import {
  Button,
  Card,
  CardHeader,
  Checkbox,
  Field,
  Input,
  PasswordInput,
  StatusBadge,
  type StatusTone,
  toast,
} from "@/shared/ui";

type RdStatus = "disconnected" | "connected" | "error";

const STATUS: Record<RdStatus, { tone: StatusTone; label: string }> = {
  disconnected: { tone: "neutral", label: "Não conectada" },
  connected: { tone: "success", label: "Conectada" },
  error: { tone: "danger", label: "Falhou" },
};

/** Autorização OAuth do RD Station Marketing. A volta cai nesta mesma página. */
const RD_AUTH_URL = "https://api.rd.services/auth/dialog";
const STATE_KEY = "rd-oauth-state";
const redirectUri = () => `${window.location.origin}/integracoes`;

/**
 * Acesso ao RD Station Marketing por OAuth (app "ARP ControlApp" na RD Station
 * App Store), no mesmo formato do copiloto: Client ID e secret, Conectar
 * (abre a autorização no RD e volta aqui com ?code) e a conversão que leva ao
 * RD quem marcou "Quero receber novidades e ofertas" (rd-station-job.ts).
 *
 * atalho: só o layout e o Conectar. Faltam na API: salvar/ler a configuração
 * (secret e refresh_token cifrados, nunca voltam ao navegador), trocar o code
 * pelo refresh_token, testar e remover. Os pontos estão marcados com "atalho".
 */
export function RdStationCard() {
  // atalho: valores vindos do GET da configuração.
  const status = "disconnected" as RdStatus;
  const statusText: string | null = null;
  const testedAt: string | null = null;
  const configuredAt: string | null = null;
  const hasSecret = false;

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [conversion, setConversion] = useState("");
  const [active, setActive] = useState(true);
  const [saveIfTestFails, setSaveIfTestFails] = useState(false);
  const [authCode, setAuthCode] = useState<string | null>(null);

  useOAuthReturn(setAuthCode);

  const connect = () => {
    const id = clientId.trim();
    if (!id) return;
    const state = crypto.randomUUID();
    sessionStorage.setItem(STATE_KEY, state);
    // atalho: o copiloto salva Client ID e secret antes de abrir; fazer o mesmo
    // aqui quando o PUT existir, para a API ter o secret na volta.
    const u = new URL(RD_AUTH_URL);
    u.searchParams.set("client_id", id);
    u.searchParams.set("redirect_uri", redirectUri());
    u.searchParams.set("state", state);
    window.location.assign(u.toString());
  };

  const saveAndTest = () => {
    // atalho: PUT { clientId, clientSecret (só se digitado), conversion, active,
    // saveIfTestFails } e em seguida o teste.
    toast.info("Salvar ainda não está ligado à API: nada foi gravado.");
  };
  const test = () => toast.info("Testar conexão ainda não está ligado à API."); // atalho
  const remove = () => toast.info("Remover ainda não está ligado à API."); // atalho

  return (
    <Card className="mt-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col">
          <CardHeader
            icon={Megaphone}
            title="RD Station Marketing"
            description="Leva ao RD quem marcou “Quero receber novidades e ofertas” no app: nome, e-mail e o aceite. Quem não marcou nunca vai."
          />
          <div className="mt-4">
            <StatusBadge tone={STATUS[status].tone}>{STATUS[status].label}</StatusBadge>
          </div>
          <div className="mt-3 space-y-1 text-sm text-neutral-600">
            <p>
              {statusText ??
                "Preencha o Client ID e o secret do app e clique em Conectar com o RD Station."}
            </p>
            {testedAt && <p className="text-xs text-neutral-500">Testada em {testedAt}</p>}
            {configuredAt && (
              <p className="text-xs text-neutral-500">Configurada em {configuredAt}</p>
            )}
          </div>
          {authCode && (
            <output className="mt-4 block rounded-xl bg-sky-50 p-3 text-sm text-sky-800">
              Autorização recebida do RD. Falta a API trocar o código pelo acesso.
            </output>
          )}
          <div className="mt-auto flex flex-wrap gap-2 pt-5">
            <Button icon={PlugZap} variant="secondary" onClick={test} disabled={!hasSecret}>
              Testar conexão
            </Button>
            <Button icon={Trash2} variant="ghost" onClick={remove} disabled={!hasSecret}>
              Remover
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-900/[0.06] p-4 sm:p-5">
          <div className="grid gap-4">
            <Field
              label="Client ID"
              hint="Do app criado na RD Station App Store (My Apps › ARP ControlApp)."
            >
              <Input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
            <Field label="Client secret">
              <PasswordInput
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={hasSecret ? "•••••••• em branco mantém o salvo" : "Cole o secret aqui"}
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
            <Field
              label="Identificador da conversão"
              hint="Nome do evento no RD. A automação de lá põe o contato no funil e na etapa."
            >
              <Input
                value={conversion}
                onChange={(e) => setConversion(e.target.value)}
                placeholder="app-arp-cadastro"
                spellCheck={false}
              />
            </Field>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Checkbox
                label="Ativa"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              <Checkbox
                label="Salvar mesmo se o teste falhar"
                checked={saveIfTestFails}
                onChange={(e) => setSaveIfTestFails(e.target.checked)}
              />
            </div>

            <div className="rounded-xl bg-neutral-900/[0.04] p-4">
              <p className="text-sm text-neutral-600">
                Com o Client ID e o secret preenchidos, este botão abre a autorização no RD. Na
                volta, o sistema guarda o acesso e passa a enviar os contatos a cada 10 minutos.
              </p>
              <Button
                className="mt-3"
                icon={Link2}
                variant="secondary"
                onClick={connect}
                disabled={!clientId.trim()}
              >
                Conectar com o RD Station
              </Button>
            </div>

            <div>
              <Button icon={Save} onClick={saveAndTest}>
                Salvar e testar
              </Button>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-neutral-500">
        <KeyRound className="size-3.5" aria-hidden />O secret e o acesso ficam só no servidor e não
        voltam para esta tela.
      </p>
    </Card>
  );
}

/**
 * Volta da autorização: confere o state (contra CSRF), guarda o code e limpa
 * a URL. O ref evita processar duas vezes (StrictMode roda o efeito em dobro).
 */
function useOAuthReturn(onCode: (code: string) => void) {
  const [params, setParams] = useSearchParams();
  const done = useRef(false);

  useEffect(() => {
    const code = params.get("code");
    if (!code || done.current) return;
    done.current = true;
    const expected = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
    setParams({}, { replace: true });
    if (!expected || params.get("state") !== expected) {
      toast.error("A volta do RD não confere com esta sessão. Clique em Conectar de novo.");
      return;
    }
    onCode(code);
    // atalho: POST do code para a API trocar pelo refresh_token (com o secret salvo).
    toast.info("Autorização recebida do RD. A troca pelo acesso ainda não está ligada à API.");
  }, [params, setParams, onCode]);
}

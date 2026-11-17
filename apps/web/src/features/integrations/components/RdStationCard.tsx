import type { RdStationConfig, RdStationStatus } from "@arp/contracts";
import { Clock, KeyRound, Link2, Megaphone, PlugZap, Save, Trash2, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { errorMessage } from "@/shared/api";
import { formatDateTime } from "@/shared/lib/format";
import {
  Button,
  Can,
  Card,
  CardHeader,
  Checkbox,
  confirmar,
  Field,
  InfoItem,
  Input,
  PasswordInput,
  Skeleton,
  StatusBadge,
  type StatusTone,
  toast,
} from "@/shared/ui";
import {
  useConnectRdStation,
  useRdStation,
  useRemoveRdStation,
  useSaveRdStation,
  useTestRdStation,
} from "../api";

const STATUS: Record<RdStationStatus, { tone: StatusTone; label: string }> = {
  disconnected: { tone: "neutral", label: "Não conectada" },
  connected: { tone: "success", label: "Conectada" },
  error: { tone: "danger", label: "Falhou" },
};

/** Autorização OAuth do RD Station Marketing. A volta cai nesta mesma página. */
const RD_AUTH_URL = "https://api.rd.services/auth/dialog";
const STATE_KEY = "rd-oauth-state";
const redirectUri = () => `${window.location.origin}/integracoes`;

/**
 * RD Station Marketing por OAuth (app "ARP ControlApp" na RD Station App
 * Store), no formato do copiloto: Client ID e secret, Conectar (autoriza no
 * RD e volta aqui com ?code), conversão e o envio de quem marcou "Quero
 * receber novidades e ofertas". O secret e o acesso ficam só na API.
 */
export function RdStationCard() {
  return (
    <Can permission="settings.manage">
      <RdStationCardContent />
    </Can>
  );
}

function RdStationCardContent() {
  const query = useRdStation();
  useOAuthReturn();

  return (
    <Card className="mt-6">
      {query.data ? (
        <RdStationForm config={query.data} />
      ) : query.isError ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-600">
          <span>Não deu para carregar o RD Station: {errorMessage(query.error)}</span>
          <Button size="sm" variant="secondary" onClick={() => query.refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : (
        <Skeleton className="h-72" />
      )}
    </Card>
  );
}

function RdStationForm({ config }: { config: RdStationConfig }) {
  const save = useSaveRdStation();
  const test = useTestRdStation();
  const remove = useRemoveRdStation();

  const [clientId, setClientId] = useState(config.clientId ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [conversion, setConversion] = useState(config.conversion ?? "");
  const [active, setActive] = useState(config.configuredAt ? config.active : true);
  const [saveIfTestFails, setSaveIfTestFails] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const canSave = Boolean(clientId.trim() && (clientSecret.trim() || config.hasSecret));
  const connected = config.status !== "disconnected";

  const body = (skipTest: boolean) => ({
    clientId: clientId.trim(),
    ...(clientSecret.trim() ? { clientSecret: clientSecret.trim() } : {}),
    conversion: conversion.trim() || null,
    active,
    saveIfTestFails,
    skipTest,
  });

  const saveAndTest = () =>
    save.mutate(body(false), {
      onSuccess: (c) => {
        setClientSecret("");
        if (c.status === "connected") toast.success(`Salvo. ${c.message ?? ""}`.trim());
        else if (c.status === "error") toast.error(`Salvo, mas o teste falhou: ${c.message}`);
        else toast.success("Salvo. Agora clique em Conectar com o RD Station.");
      },
      onError: (e) => toast.error(errorMessage(e)),
    });

  // Como no copiloto: grava Client ID e secret antes de abrir a autorização,
  // para a API ter o secret quando o RD voltar com o code.
  const connect = async () => {
    setConnecting(true);
    try {
      await save.mutateAsync(body(true));
      setClientSecret("");
      const state = crypto.randomUUID();
      sessionStorage.setItem(STATE_KEY, state);
      const u = new URL(RD_AUTH_URL);
      u.searchParams.set("client_id", clientId.trim());
      u.searchParams.set("redirect_uri", redirectUri());
      u.searchParams.set("state", state);
      window.location.assign(u.toString());
    } catch (e) {
      setConnecting(false);
      toast.error(errorMessage(e));
    }
  };

  const runTest = () =>
    test.mutate(undefined, {
      onSuccess: (c) =>
        c.status === "connected"
          ? toast.success(c.message ?? "Conexão ok.")
          : toast.error(`O teste falhou: ${c.message}`),
      onError: (e) => toast.error(errorMessage(e)),
    });

  const runRemove = async () => {
    const ok = await confirmar({
      title: "Remover a conexão com o RD Station?",
      description:
        "O Client ID, o secret e a autorização são apagados e o envio dos contatos para. Quem já foi ao RD continua lá.",
      confirmLabel: "Remover conexão",
      danger: true,
    });
    if (!ok) return;
    remove.mutate(undefined, {
      onSuccess: () => {
        setClientId("");
        setClientSecret("");
        setConversion("");
        toast.success("Conexão com o RD Station removida.");
      },
      onError: (e) => toast.error(errorMessage(e)),
    });
  };

  const status = STATUS[config.status];
  const defaultText = connected
    ? null
    : config.hasSecret
      ? "Falta autorizar: clique em Conectar com o RD Station."
      : "Preencha o Client ID e o secret do app e clique em Conectar com o RD Station.";

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col">
          <CardHeader
            icon={Megaphone}
            title="RD Station Marketing"
            description="Leva ao RD quem marcou “Quero receber novidades e ofertas” no app: nome, e-mail e o aceite. Quem não marcou nunca vai."
          />
          <div className="mt-4">
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          </div>
          <div className="mt-3 space-y-1 text-sm text-neutral-600">
            <p>{config.message ?? defaultText}</p>
            {connected && !config.active && (
              <p>Desativada: os contatos não estão sendo enviados.</p>
            )}
            {connected && config.active && !config.conversion && (
              <p>Falta o identificador da conversão para começar a enviar.</p>
            )}
            {config.testedAt && (
              <p className="text-xs text-neutral-500">
                Testada em {formatDateTime(config.testedAt)}
              </p>
            )}
            {config.configuredAt && (
              <p className="text-xs text-neutral-500">
                Configurada em {formatDateTime(config.configuredAt)}
                {config.configuredBy && ` por ${config.configuredBy}`}
              </p>
            )}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <InfoItem label="Na fila para o RD" icon={Users}>
              {config.pending}
            </InfoItem>
            <InfoItem label="Último envio" icon={Clock}>
              {config.lastSentAt ? formatDateTime(config.lastSentAt) : "—"}
            </InfoItem>
          </div>

          <div className="mt-auto flex flex-wrap gap-2 pt-5">
            <Button
              icon={PlugZap}
              variant="secondary"
              onClick={runTest}
              loading={test.isPending}
              disabled={!connected}
            >
              Testar conexão
            </Button>
            <Button
              icon={Trash2}
              variant="ghost"
              onClick={runRemove}
              loading={remove.isPending}
              disabled={!config.configuredAt}
            >
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
            <Field
              label="Client secret"
              hint={connected && "Trocar o Client ID desfaz a autorização: conecte de novo."}
            >
              <PasswordInput
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={
                  config.hasSecret ? "•••••••• em branco mantém o salvo" : "Cole o secret aqui"
                }
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
            <Field
              label="Identificador da conversão"
              hint="Nome do evento no RD. A automação de lá põe o contato no funil e na etapa. Depois de usar, não mude."
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
                Com o Client ID e o secret preenchidos, este botão salva os dois e abre a
                autorização no RD. Na volta, o sistema guarda o acesso e passa a enviar os contatos
                a cada 10 minutos.
              </p>
              <Button
                className="mt-3"
                icon={Link2}
                variant="secondary"
                onClick={connect}
                loading={connecting}
                disabled={!canSave}
              >
                {connected ? "Conectar de novo" : "Conectar com o RD Station"}
              </Button>
            </div>

            <div>
              <Button
                icon={Save}
                onClick={saveAndTest}
                loading={save.isPending && !connecting}
                disabled={!canSave}
              >
                {connected ? "Salvar e testar" : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-neutral-500">
        <KeyRound className="size-3.5" aria-hidden />O secret e o acesso ficam só no servidor e não
        voltam para esta tela.
      </p>
    </>
  );
}

/**
 * Volta da autorização: confere o state (contra CSRF), manda o code para a
 * API trocar pelo acesso e limpa a URL. O ref evita processar duas vezes
 * (StrictMode roda o efeito em dobro e o code vale uma vez só).
 */
function useOAuthReturn() {
  const [params, setParams] = useSearchParams();
  const connect = useConnectRdStation();
  const done = useRef(false);

  useEffect(() => {
    const code = params.get("code");
    const rdError = params.get("error");
    if ((!code && !rdError) || done.current) return;
    done.current = true;
    const expected = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
    setParams({}, { replace: true });
    if (rdError || !code) {
      toast.error("A autorização no RD foi cancelada ou recusada.");
      return;
    }
    if (!expected || params.get("state") !== expected) {
      toast.error("A volta do RD não confere com esta sessão. Clique em Conectar de novo.");
      return;
    }
    connect.mutate(code, {
      onSuccess: (c) =>
        c.status === "connected"
          ? toast.success(`RD Station conectado. ${c.message ?? ""}`.trim())
          : toast.error(`Autorizado, mas o teste falhou: ${c.message}`),
      onError: (e) => toast.error(errorMessage(e)),
    });
  }, [params, setParams, connect]);
}

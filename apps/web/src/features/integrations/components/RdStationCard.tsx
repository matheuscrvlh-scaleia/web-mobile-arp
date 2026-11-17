import { Clock, Megaphone, PlugZap, Save, Users } from "lucide-react";
import { useState } from "react";
import {
  Button,
  Card,
  CardHeader,
  Field,
  InfoItem,
  Input,
  PasswordInput,
  StatusBadge,
  type StatusTone,
  Switch,
  toast,
} from "@/shared/ui";

type RdStatus = "off" | "ok" | "error";

const STATUS: Record<RdStatus, { tone: StatusTone; label: string }> = {
  off: { tone: "neutral", label: "Desligado" },
  ok: { tone: "success", label: "Enviando" },
  error: { tone: "danger", label: "RD recusou o último envio" },
};

/**
 * Acesso ao RD Station Marketing: chave de API, conversão e liga/desliga do
 * envio dos contatos que aceitaram receber novidades (rd-station-job.ts na API).
 * atalho: só o layout. Estado local e botões sem API; trocar pelos hooks de
 * GET/PUT da configuração e do teste quando a rota existir.
 */
export function RdStationCard() {
  // atalho: valores vindos da API. keyHint = últimos 4 da chave salva (a chave nunca volta).
  const [enabled, setEnabled] = useState(false);
  const keyHint: string | null = null;
  const [apiKey, setApiKey] = useState("");
  const [conversion, setConversion] = useState("");
  // atalho: status vem da API; até lá fica "Desligado" para não sugerir envio que não existe.
  const status = "off" as RdStatus;
  const pending: number | null = null;
  const lastSentAt: string | null = null;

  const hasKey = Boolean(apiKey.trim() || keyHint);
  const canEnable = hasKey && Boolean(conversion.trim());

  const save = () => {
    // atalho: PUT da configuração (só manda apiKey se foi digitada uma nova);
    // no sucesso: keyHint = últimos 4 da chave, setApiKey("") e toast.success.
    toast.info("Salvar ainda não está ligado à API: nada foi gravado.");
  };

  const test = () => {
    // atalho: POST de teste no servidor (valida a chave sem criar contato).
    toast.info("Teste de conexão ainda não ligado à API.");
  };

  return (
    <Card className="mt-6">
      <CardHeader
        icon={Megaphone}
        title="RD Station Marketing"
        description="Leva ao RD quem marcou “Quero receber novidades e ofertas” no app: nome, e-mail e o aceite. Quem não marcou nunca vai."
        action={<StatusBadge tone={STATUS[status].tone}>{STATUS[status].label}</StatusBadge>}
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field
          label="Chave de API"
          hint={
            keyHint
              ? `Chave salva terminando em ${keyHint}. Preencha só para trocar.`
              : "No RD: Configurações › Integrações › Chave de API. Fica só no servidor."
          }
        >
          <PasswordInput
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={keyHint ? `••••••••${keyHint}` : "Cole a chave aqui"}
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
      </div>

      <Switch
        className="mt-5"
        checked={enabled}
        onCheckedChange={setEnabled}
        disabled={!canEnable && !enabled}
        label="Enviar contatos ao RD"
        description={
          canEnable
            ? "A cada 10 minutos, em lotes de 50. Cada contato vai uma vez."
            : "Preencha a chave e a conversão para ligar."
        }
      />

      <div className="mt-5 grid gap-4 border-t border-neutral-900/[0.06] pt-5 sm:grid-cols-2">
        <InfoItem label="Na fila para o RD" icon={Users}>
          {pending ?? "—"}
        </InfoItem>
        <InfoItem label="Último envio" icon={Clock}>
          {lastSentAt ?? "—"}
        </InfoItem>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button icon={Save} onClick={save}>
          Salvar
        </Button>
        <Button icon={PlugZap} variant="secondary" onClick={test} disabled={!hasKey}>
          Testar conexão
        </Button>
      </div>
    </Card>
  );
}

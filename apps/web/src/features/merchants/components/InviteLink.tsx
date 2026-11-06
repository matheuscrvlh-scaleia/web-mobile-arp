import type { ActiveMerchantInvite, MerchantInvite } from "@arp/contracts";
import { Link2Off, Mail, MessageCircle } from "lucide-react";
import { errorMessage, isApiError } from "@/shared/api";
import { formatDateTime, formatRelative, plural } from "@/shared/lib/format";
import {
  Button,
  buttonClasses,
  CopyButton,
  confirmar,
  EmptyState,
  ErrorState,
  Skeleton,
  toast,
} from "@/shared/ui";
import { useCancelInvite, useCreateInvite, useMerchantInvites } from "../api";

/**
 * Gerar o link de uma loja. Se ela já tem um link valendo, a API recusa (409)
 * e aqui se pergunta: o painel não guarda o link antigo para mostrar de novo,
 * então a escolha é reenviar o mesmo ou gerar outro, que cancela o anterior.
 */
export function useGenerateInvite() {
  const create = useCreateInvite();
  const generate = (
    store: { id: string; name: string },
    onCreated: (invite: MerchantInvite) => void,
  ) => {
    const run = (replace: boolean) =>
      create.mutate(
        { storeId: store.id, replace },
        {
          onSuccess: (invite) => {
            onCreated(invite);
            if (replace) toast.info("O link anterior foi cancelado.");
          },
          onError: async (e) => {
            const active =
              isApiError(e) &&
              e.status === 409 &&
              (e.details as { reason?: string } | undefined)?.reason === "INVITE_ACTIVE";
            if (!active) return toast.error(errorMessage(e));
            const ok = await confirmar({
              title: `${store.name} já tem um link valendo`,
              description:
                "Por segurança, o painel não guarda o link para mostrar de novo. Se você ainda tem a mensagem que mandou, reenvie o mesmo link. Gerar outro cancela o anterior; quem já se cadastrou por ele continua esperando a aprovação.",
              confirmLabel: "Gerar outro e cancelar o anterior",
              cancelLabel: "Voltar",
            });
            if (ok) run(true);
          },
        },
      );
    run(false);
  };
  return { generate, isPending: create.isPending };
}

/** Endereço público do link de cadastro (o token só existe na resposta de quem gerou). */
export const inviteUrl = (token: string) => `${window.location.origin}/cadastro-lojista/${token}`;

/** WhatsApp com DDD para o wa.me (põe o 55 quando falta). */
function waNumber(raw: string | null | undefined): string {
  const d = (raw ?? "").replace(/\D/g, "");
  return d.length === 10 || d.length === 11 ? `55${d}` : d;
}

/**
 * Link recém-gerado: copiar, mandar por WhatsApp (mensagem pronta) ou por
 * e-mail. `whatsapp` = número da loja, se houver (abre a conversa direto).
 */
export function InviteLinkResult({
  invite,
  whatsapp,
}: {
  invite: MerchantInvite;
  whatsapp?: string | null | undefined;
}) {
  const url = inviteUrl(invite.token);
  const message = `Olá! Este é o link para criar o seu acesso de lojista da ${invite.store.name} no painel da ARP: ${url}\nO link vale até ${formatDateTime(invite.expiresAt)}. Depois do cadastro, a ARP aprova e você recebe um aviso por e-mail.`;
  const wa = `https://wa.me/${waNumber(whatsapp)}?text=${encodeURIComponent(message)}`;
  const mail = `mailto:?subject=${encodeURIComponent(`Seu acesso de lojista da ${invite.store.name}`)}&body=${encodeURIComponent(message)}`;

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-neutral-900/[0.04] p-3">
      <code className="min-w-0 break-all text-sm">{url}</code>
      <div className="flex flex-wrap gap-2">
        <CopyButton value={url} label="Copiar link" />
        <a
          href={wa}
          target="_blank"
          rel="noreferrer"
          className={buttonClasses({ variant: "secondary", size: "sm" })}
        >
          <MessageCircle className="size-4" aria-hidden />
          Enviar por WhatsApp
        </a>
        <a href={mail} className={buttonClasses({ variant: "secondary", size: "sm" })}>
          <Mail className="size-4" aria-hidden />
          Enviar por e-mail
        </a>
      </div>
      <p className="text-xs text-neutral-500">
        Link da {invite.store.name}, vale até {formatDateTime(invite.expiresAt)} e serve para mais
        de uma pessoa da loja. Dá para cancelar a qualquer momento em “Links ativos”.
      </p>
    </div>
  );
}

/** Links de cadastro ainda valendo, com "Cancelar link". `storeId` = só os da loja. */
export function ActiveInvites({
  storeId,
  compact = false,
}: {
  storeId?: string;
  compact?: boolean;
}) {
  const invites = useMerchantInvites(storeId ? { storeId } : {});
  const cancel = useCancelInvite();

  const onCancel = async (i: ActiveMerchantInvite) => {
    const ok = await confirmar({
      title: `Cancelar o link da ${i.store.name}?`,
      description: `Quem ainda não se cadastrou não consegue mais usar este link. ${
        i.signupsCount > 0
          ? `${plural(i.signupsCount, "cadastro feito", "cadastros feitos")} por ele continua${i.signupsCount > 1 ? "m" : ""} valendo.`
          : "Ninguém se cadastrou por ele ainda."
      }`,
      confirmLabel: "Cancelar link",
      cancelLabel: "Manter link",
      danger: true,
    });
    if (!ok) return;
    cancel.mutate(i.id, {
      onSuccess: () => toast.success("Link cancelado. Ele não abre mais o cadastro."),
      onError: (e) => toast.error(errorMessage(e)),
    });
  };

  if (invites.error) {
    return <ErrorState compact error={invites.error} onRetry={() => void invites.refetch()} />;
  }
  if (!invites.data) return <Skeleton className="h-16 rounded-2xl" />;
  if (invites.data.length === 0) {
    return compact ? (
      <p className="text-sm text-neutral-500">Nenhum link valendo agora.</p>
    ) : (
      <EmptyState compact icon={Link2Off} title="Nenhum link valendo agora" />
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-neutral-900/[0.06]">
      {invites.data.map((i) => (
        <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
          <div className="min-w-0 flex-1">
            {!storeId && <p className="truncate text-sm font-medium">{i.store.name}</p>}
            <p className="text-xs text-neutral-500">
              Criado {formatRelative(i.createdAt)}
              {i.createdBy ? ` por ${i.createdBy.name}` : ""} · vence {formatRelative(i.expiresAt)}{" "}
              ·{" "}
              {i.signupsCount > 0
                ? plural(i.signupsCount, "cadastro", "cadastros")
                : "nenhum cadastro"}
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            icon={Link2Off}
            loading={cancel.isPending && cancel.variables === i.id}
            onClick={() => void onCancel(i)}
          >
            Cancelar link
          </Button>
        </li>
      ))}
    </ul>
  );
}

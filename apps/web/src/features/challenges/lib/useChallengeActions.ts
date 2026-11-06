import type { Campaign, Challenge, ListOf } from "@arp/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Pause, Pencil, Play, QrCode, Trash2 } from "lucide-react";
import { useNavigate } from "react-router";
import { PATHS } from "@/shared/config/paths";
import { plural } from "@/shared/lib/format";
import { type ActionMenuItems, confirmar, toast } from "@/shared/ui";
import { challengeKeys, useDeleteChallenge, useSetChallengeStatus } from "../api";

type Status = Challenge["status"];

/** Texto do aviso: só diz "saiu do app" quando a campanha está mesmo no ar. */
function statusText(
  c: Pick<Challenge, "title">,
  status: Status,
  campaign?: Pick<Campaign, "status" | "phase">,
): string {
  const live = campaign?.status === "published" && campaign.phase === "live";
  if (status === "inactive")
    return live
      ? `"${c.title}" pausado: saiu do app e os QR Codes pararam de dar selo.`
      : `"${c.title}" pausado: não vai aparecer no app.`;
  return live
    ? `"${c.title}" retomado: voltou ao app.`
    : `"${c.title}" retomado: aparece no app quando a campanha estiver no ar.`;
}

/**
 * Ações de ciclo de vida do desafio, iguais na lista e no detalhe:
 * Pausar/Retomar na hora com "Desfazer" no toast; Duplicar abre o
 * formulário preenchido; Excluir só sem selos dados (confirmação simples,
 * sem digitar o nome; ativo também sai). `campaign` ajusta os textos.
 */
export function useChallengeActions(campaign?: Pick<Campaign, "status" | "phase">) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const setStatus = useSetChallengeStatus();
  const remove = useDeleteChallenge();

  /** Status do desafio agora no cache (o "Desfazer" pode vir depois de outra ação). */
  const currentStatus = (id: string): Status | undefined =>
    qc.getQueryData<Challenge>(challengeKeys.detail(id))?.status ??
    qc
      .getQueriesData<ListOf<Challenge>>({ queryKey: challengeKeys.lists() })
      .flatMap(([, l]) => l?.data ?? [])
      .find((x) => x.id === id)?.status;

  const apply = (c: Pick<Challenge, "id" | "title">, status: Status, undo: boolean) =>
    setStatus.mutate(
      { id: c.id, status },
      {
        onSuccess: () =>
          toast.success(statusText(c, status, campaign), {
            // Um aviso por desafio: a ação nova fecha o "Desfazer" da anterior.
            key: `desafio:${c.id}`,
            action: undo
              ? {
                  label: status === "inactive" ? "Desfazer pausa" : "Pausar de novo",
                  onClick: () => {
                    if (currentStatus(c.id) !== status) {
                      toast.info(`"${c.title}" já mudou depois disso: nada foi desfeito.`);
                      return;
                    }
                    apply(c, status === "inactive" ? "active" : "inactive", false);
                  },
                }
              : undefined,
          }),
        onError: (e) => toast.fromError(e),
      },
    );

  const pause = (c: Challenge) => apply(c, "inactive", true);
  const resume = (c: Challenge) => apply(c, "active", true);
  const duplicate = (c: Challenge) => navigate(PATHS.challengeNew(c.campaign.id, c.id));

  const askDelete = async (c: Challenge, onDeleted?: () => void) => {
    const ok = await confirmar({
      title: `Excluir "${c.title}"?`,
      description: [
        c.qrCodesCount > 0
          ? `O desafio e ${plural(c.qrCodesCount, "QR Code", "QR Codes")} dele somem; cartazes impressos deixam de valer.`
          : "O desafio some do painel e do app.",
        c.coupon ? `O cupom "${c.coupon.title}" deixa de dar selo.` : "",
        "Ninguém cumpriu este desafio ainda, então nada se perde do histórico.",
      ]
        .filter(Boolean)
        .join(" "),
      confirmLabel: "Excluir desafio",
      danger: true,
    });
    if (!ok) return;
    remove.mutate(c.id, {
      onSuccess: () => {
        toast.success(`"${c.title}" excluído.`);
        onDeleted?.();
      },
      onError: (e) => toast.fromError(e),
    });
  };

  /**
   * Itens do menu "⋯". `row` = na lista (inclui Editar e QR Codes);
   * `status: false` quando Pausar/Retomar já tem botão próprio.
   */
  const menuItems = (
    c: Challenge,
    {
      row = false,
      status = true,
      onDeleted,
    }: { row?: boolean; status?: boolean; onDeleted?: () => void } = {},
  ): ActionMenuItems => {
    const used = c.completionsCount > 0;
    return [
      row && {
        label: "Editar",
        icon: Pencil,
        onSelect: () => navigate(`${PATHS.challenge(c.id)}?aba=dados`),
      },
      row &&
        c.validation === "qr" && {
          label: "QR Codes",
          icon: QrCode,
          onSelect: () => navigate(`${PATHS.challenge(c.id)}?aba=qr`),
        },
      { label: "Duplicar", icon: Copy, onSelect: () => duplicate(c) },
      status &&
        (c.status === "active"
          ? { label: "Pausar", icon: Pause, onSelect: () => pause(c) }
          : { label: "Retomar", icon: Play, onSelect: () => resume(c) }),
      {
        label: "Excluir",
        icon: Trash2,
        danger: true,
        disabled: used,
        hint: used
          ? `Já deu ${plural(c.completionsCount, "selo", "selos")}: pause em vez de excluir. Quem ganhou mantém o selo.`
          : undefined,
        onSelect: () => void askDelete(c, onDeleted),
      },
    ];
  };

  return {
    pause,
    resume,
    duplicate,
    askDelete,
    menuItems,
    /** Id do desafio com Pausar/Retomar em andamento (para travar o switch). */
    pendingId: setStatus.isPending ? setStatus.variables?.id : undefined,
    deleting: remove.isPending,
  };
}

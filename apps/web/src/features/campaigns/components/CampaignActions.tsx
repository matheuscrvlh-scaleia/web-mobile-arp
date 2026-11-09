import type { Campaign, CampaignStatus, Challenge } from "@arp/contracts";
import { useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  CalendarPlus,
  CircleCheck,
  CircleX,
  EyeOff,
  Send,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useChallenges } from "@/features/challenges";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { cn } from "@/shared/lib/cn";
import { formatDateTime, plural } from "@/shared/lib/format";
import { ActionMenu, type ActionMenuItems, Button, Card, confirmar, toast } from "@/shared/ui";
import { campaignKeys, useDeleteCampaign, useUpdateCampaign } from "../api";
import { DuplicateCampaignModal } from "./DuplicateCampaignModal";

/** Texto do aviso depois da mudança (`before` = como estava; `after` = DTO da API). */
function statusDoneText(before: Campaign, after: Campaign): string {
  const wasLive = before.status === "published" && before.phase === "live";
  if (after.status === "published") {
    if (after.phase === "upcoming")
      return `agendada: entra no app em ${formatDateTime(after.startsAt)}`;
    if (after.phase === "ended") return "publicada, mas o período já acabou";
    return "publicada: já aparece no app";
  }
  if (after.status === "archived") return wasLive ? "arquivada: saiu do app" : "arquivada";
  if (before.status === "archived") return "desarquivada: voltou como rascunho";
  if (wasLive) return "voltou para rascunho: saiu do app";
  return "voltou para rascunho: não entra no app sozinha";
}

/** "Desfazer" com o nome da ação (não confunde com o "Desfazer" do formulário). */
function undoLabel(status: CampaignStatus, undoTo: CampaignStatus): string {
  if (status === "archived") return "Desfazer arquivamento";
  if (status === "published") return "Desfazer publicação";
  return undoTo === "archived" ? "Arquivar de novo" : "Publicar de novo";
}

/**
 * Ciclo de vida da campanha, sem passar pelo formulário: Publicar,
 * Despublicar, Arquivar, Desarquivar, Duplicar para o próximo mês e Excluir
 * (só sem selos dados). Reversível aplica na hora com "Desfazer"; o que
 * afeta visitantes agora pede confirmação dizendo quantos.
 */
function useCampaignLifecycle(campaign: Campaign) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const update = useUpdateCampaign(campaign.id);
  const remove = useDeleteCampaign();
  const live = campaign.status === "published" && campaign.phase === "live";
  // Um aviso por campanha: a ação nova fecha o "Desfazer" da anterior.
  const toastKey = `campanha:${campaign.id}`;

  /** A campanha como está agora no cache (o "Desfazer" pode vir depois de outra ação). */
  const latest = (): Campaign =>
    qc.getQueryData<Campaign>(campaignKeys.detail(campaign.id)) ??
    qc
      .getQueryData<{ data: Campaign[] }>(campaignKeys.list())
      ?.data.find((c) => c.id === campaign.id) ??
    campaign;

  const setStatus = (status: CampaignStatus, undoTo?: CampaignStatus) => {
    const before = latest();
    update.mutate(
      { status },
      {
        onSuccess: (after) =>
          toast.success(`"${after.name}" ${statusDoneText(before, after)}.`, {
            key: toastKey,
            action: undoTo
              ? {
                  label: undoLabel(status, undoTo),
                  onClick: () => {
                    // Só desfaz se a campanha continua como esta ação a deixou.
                    if (latest().status !== status) {
                      toast.info(`"${after.name}" já mudou depois disso: nada foi desfeito.`, {
                        key: toastKey,
                      });
                      return;
                    }
                    setStatus(undoTo);
                  },
                }
              : undefined,
          }),
        onError: (e) => toast.fromError(e),
      },
    );
  };

  /** Tirar do app uma campanha no ar com participantes pede confirmação. */
  const leaveApp = async (status: "draft" | "archived") => {
    if (live && campaign.participantsCount > 0) {
      const verb = status === "draft" ? "Despublicar" : "Arquivar";
      const ok = await confirmar({
        title: `${verb} "${campaign.name}"?`,
        description: `A campanha sai do app agora e os QR Codes param de dar selo. ${plural(campaign.participantsCount, "participante mantém os selos que já ganhou", "participantes mantêm os selos que já ganharam")}.`,
        confirmLabel: `${verb} campanha`,
        cancelLabel: "Manter no ar",
      });
      if (ok) setStatus(status);
      return;
    }
    setStatus(status, campaign.status);
  };

  const askDelete = async () => {
    const ok = await confirmar({
      title: `Excluir "${campaign.name}"?`,
      description:
        campaign.challengesCount > 0
          ? `${plural(campaign.challengesCount, "desafio", "desafios")}, os QR Codes e as faixas vão junto. Ninguém ganhou selo nela ainda. Não dá para desfazer.`
          : "Ninguém ganhou selo nela ainda. Não dá para desfazer.",
      confirmLabel: "Excluir campanha",
      danger: true,
    });
    if (!ok) return;
    remove.mutate(campaign.id, {
      onSuccess: () => {
        toast.success(`"${campaign.name}" excluída.`);
        navigate(PATHS.campaigns);
      },
      onError: (e) => toast.fromError(e),
    });
  };

  return { update, setStatus, leaveApp, askDelete };
}

/** Itens do "⋯" da campanha (cabeçalho e cartão). */
function menuItems(
  c: Campaign,
  lc: ReturnType<typeof useCampaignLifecycle>,
  onDuplicate: () => void,
  { includeStatus }: { includeStatus: boolean },
): ActionMenuItems {
  const used = c.sealsAwarded > 0;
  return [
    { label: "Duplicar para o próximo mês", icon: CalendarPlus, onSelect: onDuplicate },
    // No cartão (sem botão principal), o menu traz também Despublicar/Desarquivar.
    includeStatus &&
      c.status === "published" && {
        label: "Despublicar",
        icon: EyeOff,
        onSelect: () => void lc.leaveApp("draft"),
      },
    includeStatus &&
      c.status === "archived" && {
        label: "Desarquivar",
        icon: ArchiveRestore,
        onSelect: () => lc.setStatus("draft", "archived"),
      },
    c.status !== "archived" && {
      label: "Arquivar",
      icon: Archive,
      onSelect: () => void lc.leaveApp("archived"),
    },
    {
      label: "Excluir",
      icon: Trash2,
      danger: true,
      disabled: used,
      hint: used
        ? `Já deu ${plural(c.sealsAwarded, "selo", "selos")}: arquive em vez de excluir. Quem ganhou mantém os selos.`
        : undefined,
      onSelect: () => void lc.askDelete(),
    },
  ];
}

/** "⋯" do cartão da campanha na lista. */
export function CampaignCardMenu({ campaign }: { campaign: Campaign }) {
  const lc = useCampaignLifecycle(campaign);
  const [duplicating, setDuplicating] = useState(false);
  return (
    <>
      <ActionMenu
        size="sm"
        ariaLabel={`Mais ações de ${campaign.name}`}
        items={menuItems(campaign, lc, () => setDuplicating(true), { includeStatus: true })}
      />
      {duplicating && (
        <DuplicateCampaignModal campaign={campaign} onClose={() => setDuplicating(false)} />
      )}
    </>
  );
}

interface CheckItem {
  ok: boolean;
  /** Sem isso não publica (ex.: nenhum desafio ativo). */
  blocks?: boolean;
  text: string;
}

/** O que falta para publicar (rascunho): desafios, QR Codes, faixas, período. */
function publishChecklist(c: Campaign, challenges: Challenge[] | undefined): CheckItem[] {
  if (!challenges) return [];
  const active = challenges.filter((ch) => ch.status === "active");
  const qr = active.filter((ch) => ch.validation === "qr");
  const noQr = qr.filter((ch) => ch.qrCodesCount === 0);
  const ended = new Date(c.endsAt).getTime() <= Date.now();
  return [
    {
      ok: active.length > 0,
      blocks: true,
      text:
        active.length > 0
          ? plural(active.length, "desafio ativo", "desafios ativos")
          : "Nenhum desafio ativo: crie ou retome um desafio",
    },
    // Só fala de QR quando há desafio de QR ("pronto" com 0 desafios engana).
    ...(qr.length > 0
      ? [
          {
            ok: noQr.length === 0,
            text:
              noQr.length === 0
                ? "Desafios de QR com QR Code"
                : `${plural(noQr.length, "desafio de QR sem QR Code", "desafios de QR sem QR Code")} (${noQr.map((ch) => ch.title).join(", ")})`,
          },
        ]
      : []),
    {
      ok: c.tiers.length > 0,
      text:
        c.tiers.length > 0
          ? plural(c.tiers.length, "faixa de benefício", "faixas de benefício")
          : "Sem faixas de benefício (opcional)",
    },
    {
      ok: !ended,
      blocks: true,
      text: ended ? "O período já acabou: mude as datas em Dados" : "Período válido",
    },
  ];
}

/**
 * Cabeçalho da campanha: botão da ação principal do status (Publicar,
 * Despublicar, Desarquivar) e o "⋯". Em rascunho, o checklist do que falta
 * para publicar vem logo abaixo (CampaignPublishChecklist).
 */
export function CampaignHeaderActions({ campaign }: { campaign: Campaign }) {
  const { can } = useAuth();
  const lc = useCampaignLifecycle(campaign);
  const challenges = useChallenges(campaign.id, { enabled: campaign.status === "draft" });
  const [duplicating, setDuplicating] = useState(false);
  if (!can("challenges.manage")) return null;
  const checklist = publishChecklist(campaign, challenges.data);
  const blocked = checklist.some((i) => i.blocks && !i.ok);
  const startsLater = new Date(campaign.startsAt).getTime() > Date.now();

  const publish = async () => {
    const warnings = checklist.filter((i) => !i.ok && !i.blocks).map((i) => i.text);
    const ok = await confirmar({
      title: `Publicar "${campaign.name}"?`,
      description: [
        startsLater
          ? `Entra no app em ${formatDateTime(campaign.startsAt)}, sozinha.`
          : "Entra no app agora: os visitantes já veem os desafios.",
        warnings.length > 0
          ? `Atenção: ${warnings.map((w) => w[0]?.toLowerCase() + w.slice(1)).join("; ")}.`
          : "",
      ]
        .filter(Boolean)
        .join(" "),
      confirmLabel: startsLater ? "Agendar publicação" : "Publicar agora",
    });
    if (ok) lc.setStatus("published", "draft");
  };

  return (
    <>
      {campaign.status === "draft" && (
        <Button
          icon={Send}
          onClick={() => void publish()}
          disabled={blocked || !challenges.data}
          loading={lc.update.isPending}
        >
          {startsLater ? "Agendar publicação" : "Publicar"}
        </Button>
      )}
      {campaign.status === "published" && (
        <Button
          variant="secondary"
          icon={EyeOff}
          onClick={() => void lc.leaveApp("draft")}
          loading={lc.update.isPending}
        >
          Despublicar
        </Button>
      )}
      {campaign.status === "archived" && (
        <Button
          icon={ArchiveRestore}
          onClick={() => lc.setStatus("draft", "archived")}
          loading={lc.update.isPending}
        >
          Desarquivar
        </Button>
      )}
      <ActionMenu
        label="Mais"
        ariaLabel={`Mais ações de ${campaign.name}`}
        items={menuItems(campaign, lc, () => setDuplicating(true), { includeStatus: false })}
      />
      {duplicating && (
        <DuplicateCampaignModal campaign={campaign} onClose={() => setDuplicating(false)} />
      )}
    </>
  );
}

/** Checklist de publicação (só rascunho): o que já está pronto e o que falta. */
export function CampaignPublishChecklist({ campaign }: { campaign: Campaign }) {
  const { can } = useAuth();
  const challenges = useChallenges(campaign.id, { enabled: campaign.status === "draft" });
  if (campaign.status !== "draft" || !challenges.data || !can("challenges.manage")) return null;
  const items = publishChecklist(campaign, challenges.data);
  const ready = items.every((i) => i.ok || !i.blocks);
  return (
    <Card className="mb-5">
      <p className="text-sm font-semibold text-neutral-900">
        {ready ? "Pronta para publicar" : "Antes de publicar"}
        <span className="font-normal text-neutral-500"> · rascunho não aparece no app</span>
      </p>
      <ul
        data-guia="checklist"
        aria-label="Checklist de publicação"
        className="mt-3 flex flex-wrap gap-x-5 gap-y-2"
      >
        {items.map((i) => {
          const Icon = i.ok ? CircleCheck : i.blocks ? CircleX : TriangleAlert;
          return (
            <li
              key={i.text}
              className={cn(
                "inline-flex items-center gap-1.5 text-sm",
                i.ok ? "text-green-700" : i.blocks ? "text-red-700" : "text-amber-800",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="sr-only">{i.ok ? "Pronto:" : i.blocks ? "Falta:" : "Atenção:"}</span>
              {i.text}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

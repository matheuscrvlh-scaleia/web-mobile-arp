import type { Coupon } from "@arp/contracts";
import { useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  CircleStop,
  Copy,
  type LucideIcon,
  Pause,
  Pencil,
  Play,
  Send,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { duplicateHref } from "@/shared/hooks";
import { formatDateTime, formatNumber, plural } from "@/shared/lib/format";
import {
  ActionMenu,
  type ActionMenuItems,
  Button,
  ButtonLink,
  confirmar,
  toast,
} from "@/shared/ui";
import {
  couponKeys,
  couponsApi,
  useArchiveCoupon,
  useChangeCouponStatus,
  useDeleteCoupon,
} from "../api";

type ActionCoupon = Pick<
  Coupon,
  "id" | "title" | "status" | "lifecycle" | "startsAt" | "endsAt" | "stock"
>;

interface Action {
  label: string;
  icon: LucideIcon;
  run: () => void;
}

/** Cupons pegos em qualquer situação (com algum, não dá para excluir). */
export const claimsCount = (c: Pick<Coupon, "stock">) =>
  c.stock.waiting + c.stock.redeemed + c.stock.returned;

/**
 * Ações de ciclo de vida de uma promoção (as mesmas no cabeçalho do detalhe,
 * no "⋯" do cartão e da linha). Reversível (pausar, retomar, arquivar)
 * aplica na hora com "Desfazer"; publicar, encerrar e excluir confirmam.
 */
export function useCouponActions(c: ActionCoupon, { onDeleted }: { onDeleted?: () => void } = {}) {
  const { can } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const change = useChangeCouponStatus();
  const archive = useArchiveCoupon();
  const remove = useDeleteCoupon();
  const busy = change.isPending || archive.isPending || remove.isPending;

  const setStatus = (status: "active" | "paused", done: string, undo?: () => void) =>
    change.mutate(
      { id: c.id, status },
      {
        onSuccess: () =>
          toast.success(done, undo ? { action: { label: "Desfazer", onClick: undo } } : undefined),
        onError: (e) => toast.fromError(e),
      },
    );
  const pause = () => setStatus("paused", `“${c.title}” pausada: saiu do app.`, resume);
  function resume() {
    setStatus("active", `“${c.title}” voltou ao app.`, pause);
  }

  // O Desfazer chama a API direto: arquivada some da lista e este menu desmonta
  // (os callbacks do mutate não rodariam). Agendada arquiva direto (fica
  // pausada); o Desfazer a deixa agendada de novo.
  const flipBack = async (archived: boolean, reschedule: boolean) => {
    try {
      await couponsApi.archive(c.id, archived);
      if (reschedule) await couponsApi.changeStatus(c.id, "active");
      await qc.invalidateQueries({ queryKey: couponKeys.all });
      toast.success(
        reschedule
          ? `“${c.title}” voltou a ficar agendada.`
          : archived
            ? `“${c.title}” arquivada.`
            : `“${c.title}” desarquivada.`,
      );
    } catch (e) {
      toast.fromError(e);
    }
  };
  const setArchived = (archived: boolean) => {
    const reschedule = archived && c.lifecycle === "scheduled";
    archive.mutate(
      { id: c.id, archived },
      {
        onSuccess: () =>
          toast.success(archived ? `“${c.title}” arquivada.` : `“${c.title}” desarquivada.`, {
            action: { label: "Desfazer", onClick: () => void flipBack(!archived, reschedule) },
          }),
        onError: (e) => toast.fromError(e),
      },
    );
  };

  const future = new Date(c.startsAt).getTime() > Date.now();
  const publish = async () => {
    const ok = await confirmar({
      title: future ? `Agendar “${c.title}”?` : `Publicar “${c.title}”?`,
      description: future
        ? `Ela entra no app em ${formatDateTime(c.startsAt)}. Até lá, dá para pausar ou editar.`
        : "Ela aparece no app agora e os visitantes já podem pegar o cupom.",
      confirmLabel: future ? "Agendar" : "Publicar",
    });
    if (ok) setStatus("active", future ? "Promoção agendada." : "Promoção publicada.");
  };

  const end = async () => {
    const waiting = c.stock.waiting;
    const ok = await confirmar({
      title: `Encerrar “${c.title}”?`,
      description: `${
        waiting > 0
          ? `${plural(waiting, "visitante tem", "visitantes têm")} este cupom e ainda ${waiting === 1 ? "pode" : "podem"} usar até o prazo de cada um. `
          : ""
      }Ninguém pega mais. Encerrada não volta ao ar; para repetir, duplique.`,
      confirmLabel: "Encerrar promoção",
      cancelLabel: "Manter no ar",
      danger: true,
    });
    if (!ok) return;
    change.mutate(
      { id: c.id, status: "ended" },
      {
        onSuccess: () => toast.success(`“${c.title}” encerrada.`),
        onError: (e) => toast.fromError(e),
      },
    );
  };

  const destroy = async () => {
    const ok = await confirmar({
      title: `Excluir “${c.title}”?`,
      description: "Ela some de vez do painel. Isso não dá para desfazer.",
      confirmLabel: "Excluir promoção",
      danger: true,
    });
    if (!ok) return;
    remove.mutate(c.id, {
      onSuccess: () => {
        toast.success(`“${c.title}” excluída.`);
        onDeleted?.();
      },
      onError: (e) => toast.fromError(e),
    });
  };

  const duplicate = () => navigate(duplicateHref(PATHS.couponNew, c.id));
  const edit = () => navigate(PATHS.couponEdit(c.id));

  if (!can("coupons.manage")) return { primary: null, items: [] as ActionMenuItems, busy };

  const lc = c.lifecycle;
  const live = lc === "active" || lc === "scheduled" || lc === "soldout";
  const claims = claimsCount(c);

  const primary: Action | null =
    lc === "draft"
      ? { label: future ? "Agendar" : "Publicar", icon: Send, run: () => void publish() }
      : live
        ? { label: "Pausar", icon: Pause, run: pause }
        : lc === "paused"
          ? { label: "Retomar", icon: Play, run: resume }
          : lc === "archived"
            ? { label: "Desarquivar", icon: ArchiveRestore, run: () => setArchived(false) }
            : { label: "Duplicar como nova", icon: Copy, run: duplicate };

  const items: ActionMenuItems = [
    lc !== "ended" && lc !== "archived" && { label: "Editar", icon: Pencil, onSelect: edit },
    lc !== "ended" && { label: "Duplicar", icon: Copy, onSelect: duplicate },
    (live || lc === "paused") && {
      label: "Encerrar",
      icon: CircleStop,
      onSelect: () => void end(),
    },
    lc !== "archived" && {
      label: "Arquivar",
      icon: Archive,
      onSelect: () => setArchived(true),
      disabled: live && lc !== "scheduled",
      hint:
        live && lc !== "scheduled" ? "Está no app: pause ou encerre antes de arquivar" : undefined,
    },
    {
      label: "Excluir",
      icon: Trash2,
      danger: true,
      onSelect: () => void destroy(),
      disabled: claims > 0,
      hint:
        claims > 0
          ? `Já ${claims === 1 ? "foi pego" : "foram pegos"} ${formatNumber(claims)} ${claims === 1 ? "cupom" : "cupons"}: arquive em vez de excluir`
          : undefined,
    },
  ];

  return { primary, items, busy };
}

/** Cabeçalho do detalhe: a ação principal do status + "Mais" (⋯). */
export function CouponHeaderActions({
  coupon,
  onDeleted,
}: {
  coupon: ActionCoupon;
  onDeleted?: () => void;
}) {
  const { primary, items, busy } = useCouponActions(coupon, { onDeleted });
  if (!primary) return null;
  const editable = coupon.lifecycle !== "ended" && coupon.lifecycle !== "archived";
  return (
    <>
      {editable && (
        <ButtonLink to={PATHS.couponEdit(coupon.id)} icon={Pencil} variant="secondary">
          Editar
        </ButtonLink>
      )}
      <Button
        variant={coupon.lifecycle === "draft" ? "brand" : "secondary"}
        icon={primary.icon}
        onClick={primary.run}
        loading={busy}
      >
        {primary.label}
      </Button>
      <ActionMenu
        items={items.filter((i) => !(i && i.label === "Editar"))}
        label="Mais"
        ariaLabel={`Mais ações de ${coupon.title}`}
      />
    </>
  );
}

/** "⋯" do cartão e da linha: a ação principal primeiro, depois as outras. */
export function CouponRowActions({ coupon }: { coupon: ActionCoupon }) {
  const { primary, items } = useCouponActions(coupon);
  if (!primary) return null;
  return (
    <ActionMenu
      size="sm"
      ariaLabel={`Ações de ${coupon.title}`}
      items={[
        { label: primary.label, icon: primary.icon, onSelect: primary.run },
        ...items.filter((i) => !(i && i.label === primary.label)),
      ]}
    />
  );
}

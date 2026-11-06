import type { StoreDetail } from "@arp/contracts";
import { MapPin, Power, PowerOff, Trash2 } from "lucide-react";
import { useNavigate } from "react-router";
import { errorMessage } from "@/shared/api";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { formatRelative, plural } from "@/shared/lib/format";
import { thumbnailProps } from "@/shared/lib/images";
import { ActionMenu, Button, ButtonLink, confirmar, IconTile, toast } from "@/shared/ui";
import { useDeactivateStore, useDeleteStore, useUpdateStore } from "../api";
import { confirmDeactivate } from "./confirm-deactivate";
import { CouponsBadge, OpenNowBadge, StoreStatusBadge } from "./StoreBadges";
import { StoreCover } from "./StoreCard";

const USAGE_LABEL: Record<keyof StoreDetail["usage"], [string, string]> = {
  coupons: ["cupom", "cupons"],
  challenges: ["desafio", "desafios"],
  events: ["evento", "eventos"],
  highlights: ["destaque", "destaques"],
  notifications: ["notificação", "notificações"],
  jobs: ["vaga", "vagas"],
  merchants: ["lojista", "lojistas"],
};

/** "3 cupons e 1 lojista" (o que impede excluir); vazio = pode excluir. */
export function storeUsageText(usage: StoreDetail["usage"]): string {
  const parts = (Object.keys(USAGE_LABEL) as (keyof StoreDetail["usage"])[])
    .filter((k) => usage[k] > 0)
    .map((k) => plural(usage[k], USAGE_LABEL[k][0], USAGE_LABEL[k][1]));
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} e ${parts.at(-1)}`;
}

/** Topo da loja: capa (ou a cor da marca), logo, nome, onde fica e ações. */
export function StoreHero({ store }: { store: StoreDetail }) {
  const { can } = useAuth();
  const navigate = useNavigate();
  const deactivate = useDeactivateStore(store.id);
  const update = useUpdateStore(store.id);
  const remove = useDeleteStore();
  const manage = can("stores.manage");
  const used = storeUsageText(store.usage);

  const reactivate = (undo = false) =>
    update.mutate(
      { status: "active" },
      {
        onSuccess: () =>
          undo
            ? toast.info("Loja ativa de novo.")
            : toast.success("Loja reativada. Ela volta a aparecer no app.", {
                action: { label: "Desfazer", onClick: () => turnOff(true) },
              }),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  const turnOff = (undo = false) =>
    deactivate.mutate(undefined, {
      onSuccess: () =>
        undo
          ? toast.info("Loja desativada de novo.")
          : toast.success("Loja desativada. Saiu do guia, do mapa e da busca do app.", {
              action: { label: "Desfazer", onClick: () => reactivate(true) },
            }),
      onError: (e) => toast.error(errorMessage(e)),
    });

  /** Com cupom no ar, visitantes perdem a loja agora: pergunta antes. Sem, aplica com Desfazer. */
  const onDeactivate = async () => {
    if (await confirmDeactivate([store])) turnOff();
  };

  const onDelete = async () => {
    const ok = await confirmar({
      title: `Excluir ${store.name}?`,
      description:
        "A loja sai do sistema de vez, com horários e lugar no mapa. Não dá para desfazer. Use para cadastro duplicado ou feito por engano.",
      confirmLabel: "Excluir loja",
      danger: true,
    });
    if (!ok) return;
    remove.mutate(store.id, {
      onSuccess: () => {
        toast.success(`${store.name} excluída.`);
        navigate(PATHS.stores);
      },
      onError: (e) => toast.error(errorMessage(e)),
    });
  };

  return (
    <section
      aria-labelledby="loja-nome"
      className="relative mb-5 overflow-hidden rounded-[2rem] bg-neutral-900 text-[#fff] shadow-[0_24px_50px_-28px_rgb(0_0_0/0.55)]"
    >
      <div className="absolute inset-0">
        <StoreCover store={store} />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-[rgb(0_0_0/0.78)] via-[rgb(0_0_0/0.35)] to-[rgb(0_0_0/0.05)]" />
      <div className="relative flex min-h-56 flex-col justify-end gap-4 p-6 md:min-h-64 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 items-end gap-4">
            {store.logoUrl ? (
              <img
                {...thumbnailProps(store.logoUrl, "64px")}
                alt=""
                width={64}
                height={64}
                decoding="async"
                className="size-16 shrink-0 rounded-[1.25rem] bg-[#fff] object-cover ring-2 ring-[rgb(255_255_255/0.85)]"
              />
            ) : (
              <IconTile
                icon={store.icon}
                color={store.brandColor}
                size="lg"
                className="size-16 ring-2 ring-[rgb(255_255_255/0.85)]"
              />
            )}
            <div className="min-w-0">
              <h1
                id="loja-nome"
                className="text-3xl font-semibold tracking-tight break-words md:text-4xl"
              >
                {store.name}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[rgb(255_255_255/0.8)]">
                <span>
                  {[store.category, ...store.extraCategories].map((c) => c.name).join(" · ")}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden />
                  {store.block.name} · {store.floor.label}
                </span>
                <span className="text-[rgb(255_255_255/0.6)]">
                  Atualizada {formatRelative(store.updatedAt)}
                </span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {can("map.view") && (
              <ButtonLink
                to={PATHS.map(store.floor.id)}
                variant="secondary"
                size="sm"
                className="pointer-coarse:h-11"
                icon={MapPin}
              >
                Ver no mapa
              </ButtonLink>
            )}
            {manage &&
              (store.status === "active" ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="pointer-coarse:h-11"
                  icon={PowerOff}
                  loading={deactivate.isPending}
                  onClick={() => void onDeactivate()}
                >
                  Desativar
                </Button>
              ) : (
                <Button
                  variant="brand"
                  size="sm"
                  className="pointer-coarse:h-11"
                  icon={Power}
                  loading={update.isPending}
                  onClick={() => reactivate()}
                >
                  Reativar
                </Button>
              ))}
            {manage && (
              <ActionMenu
                ariaLabel={`Mais ações de ${store.name}`}
                size="sm"
                // Mesmo visual "secondary" dos botões ao lado: fundo e ícone invertem juntos no escuro.
                className="border border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400 hover:bg-white aria-expanded:bg-white"
                items={[
                  {
                    label: "Excluir loja",
                    icon: Trash2,
                    danger: true,
                    disabled: Boolean(used),
                    hint: used
                      ? `Já tem ${used}: desative em vez de excluir.`
                      : "Só para cadastro duplicado ou feito por engano.",
                    onSelect: () => void onDelete(),
                  },
                ]}
              />
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {/* Fundo sólido do tema (inverte no escuro junto com as cores do selo): não some sobre foto. */}
          <span className="rounded-full bg-white">
            <StoreStatusBadge status={store.status} />
          </span>
          {store.status === "active" && (
            <span className="rounded-full bg-white">
              <OpenNowBadge open={store.isOpenNow} hasHours={store.hasHours} />
            </span>
          )}
          {store.activeCouponsCount > 0 && (
            <span className="rounded-full bg-white">
              <CouponsBadge count={store.activeCouponsCount} />
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

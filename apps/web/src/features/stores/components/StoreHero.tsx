import type { StoreDetail } from "@arp/contracts";
import { MapPin, Power, PowerOff } from "lucide-react";
import { useState } from "react";
import { errorMessage } from "@/shared/api";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { formatRelative } from "@/shared/lib/format";
import { thumbnailProps } from "@/shared/lib/images";
import { Button, ButtonLink, ConfirmDialog, IconTile, toast } from "@/shared/ui";
import { useDeactivateStore, useUpdateStore } from "../api";
import { CouponsBadge, OpenNowBadge, StoreStatusBadge } from "./StoreBadges";
import { StoreCover } from "./StoreCard";

/** Topo da loja: capa (ou a cor da marca), logo, nome, onde fica e ações. */
export function StoreHero({ store }: { store: StoreDetail }) {
  const { can } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const deactivate = useDeactivateStore(store.id);
  const update = useUpdateStore(store.id);
  const manage = can("stores.manage");

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
                className="truncate text-3xl font-semibold tracking-tight md:text-4xl"
              >
                {store.name}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[rgb(255_255_255/0.8)]">
                <span>{store.category.name}</span>
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
                  icon={PowerOff}
                  onClick={() => setConfirming(true)}
                >
                  Desativar
                </Button>
              ) : (
                <Button
                  variant="brand"
                  size="sm"
                  icon={Power}
                  loading={update.isPending}
                  onClick={() =>
                    update.mutate(
                      { status: "active" },
                      {
                        onSuccess: () =>
                          toast.success("Loja reativada. Ela volta a aparecer no app."),
                        onError: (e) => toast.error(errorMessage(e)),
                      },
                    )
                  }
                >
                  Reativar
                </Button>
              ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <StoreStatusBadge status={store.status} />
          {store.status === "active" && <OpenNowBadge open={store.isOpenNow} />}
          <CouponsBadge count={store.activeCouponsCount} />
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => {
          setConfirming(false);
          deactivate.reset();
        }}
        danger
        title={`Desativar ${store.name}?`}
        description="A loja some do guia, do mapa e da busca do app. Cupons e histórico continuam guardados, e dá para reativar depois."
        confirmLabel="Desativar"
        loading={deactivate.isPending}
        error={deactivate.error}
        onConfirm={() =>
          deactivate.mutate(undefined, {
            onSuccess: () => {
              setConfirming(false);
              toast.success("Loja desativada.");
            },
          })
        }
      />
    </section>
  );
}

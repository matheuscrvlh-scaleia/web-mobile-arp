import type { StoreSummary } from "@arp/contracts";
import { MapPin } from "lucide-react";
import { Link } from "react-router";
import { PATHS } from "@/shared/config/paths";
import { cn } from "@/shared/lib/cn";
import { thumbnailProps } from "@/shared/lib/images";
import { IconTile } from "@/shared/ui";
import { CompletenessBadge, CouponsBadge, OpenNowBadge, StoreStatusBadge } from "./StoreBadges";

/**
 * Capa da loja: foto, ou um degradê na cor da marca com o ícone no canto
 * (no meio ele cobria o nome da loja no topo da página).
 * `sizes` (largura exibida) usa as miniaturas; sem ele, a original.
 */
export function StoreCover({
  store,
  className,
  sizes,
}: {
  store: Pick<StoreSummary, "coverImageUrl" | "brandColor" | "icon" | "name">;
  className?: string;
  sizes?: string;
}) {
  if (store.coverImageUrl) {
    return (
      <img
        {...(sizes ? thumbnailProps(store.coverImageUrl, sizes) : { src: store.coverImageUrl })}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn("size-full object-cover", className)}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={cn("relative size-full overflow-hidden", className)}
      style={{
        background: `radial-gradient(18rem 10rem at 100% 0%, rgb(255 255 255 / 0.28), transparent 60%), linear-gradient(135deg, ${store.brandColor}, color-mix(in oklab, ${store.brandColor} 60%, #000))`,
      }}
    >
      <IconTile
        icon={store.icon}
        color="rgb(255 255 255 / 0.14)"
        size="lg"
        className="absolute top-4 right-4 size-14 rounded-[1.25rem] opacity-80 backdrop-blur [&>svg]:size-7"
      />
    </div>
  );
}

export function StoreCard({ store }: { store: StoreSummary }) {
  return (
    <Link
      to={PATHS.store(store.id)}
      className={cn(
        "vidro flutua group flex w-full flex-col overflow-hidden rounded-[1.75rem] p-2",
        store.status === "inactive" && "opacity-70",
      )}
    >
      <div className="relative aspect-[16/9] overflow-hidden rounded-[1.4rem]">
        <StoreCover
          store={store}
          sizes="(min-width: 1536px) 25vw, (min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
        />
        <span className="absolute bottom-2 left-2">
          <IconTile
            icon={store.icon}
            color={store.brandColor}
            size="md"
            className="ring-2 ring-[#fff]"
          />
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-3 pt-3 pb-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-neutral-900">{store.name}</p>
          <p className="truncate text-xs text-neutral-500">{store.category.name}</p>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-neutral-600">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            {store.block.name} · {store.floor.label}
          </span>
        </p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          {store.status === "active" ? (
            <OpenNowBadge open={store.isOpenNow} hasHours={store.hasHours} />
          ) : (
            <StoreStatusBadge status={store.status} />
          )}
          <CouponsBadge count={store.activeCouponsCount} />
          <CompletenessBadge missing={store.missing} />
        </div>
      </div>
    </Link>
  );
}

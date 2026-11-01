import { TicketX } from "lucide-react";
import { PATHS } from "@/shared/config/paths";
import { LoadError } from "@/shared/ui";

/** Promoção que não carregou (detalhe e edição): some (404) ou falhou. */
export function CouponLoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <LoadError
      error={error}
      onRetry={onRetry}
      icon={TicketX}
      title="Promoção não encontrada"
      description="Ela pode ter sido removida ou o endereço está errado."
      back={{ to: PATHS.coupons, label: "Ver promoções" }}
    />
  );
}

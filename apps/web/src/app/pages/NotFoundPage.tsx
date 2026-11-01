import { House, MapPinOff } from "lucide-react";
import { PATHS } from "@/shared/config/paths";
import { useDocumentTitle } from "@/shared/hooks";
import { ButtonLink, Card, EmptyState } from "@/shared/ui";

export function NotFoundPage() {
  useDocumentTitle("Página não encontrada");
  return (
    <Card padding="lg">
      <EmptyState
        icon={MapPinOff}
        title="Página não encontrada"
        description="O endereço pode ter mudado ou o item foi removido. Use o menu ou a busca (Ctrl K)."
        action={
          <ButtonLink to={PATHS.home} variant="secondary" icon={House}>
            Ir para o início
          </ButtonLink>
        }
      />
    </Card>
  );
}

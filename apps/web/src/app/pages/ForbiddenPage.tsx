import { House, Lock } from "lucide-react";
import { PATHS } from "@/shared/config/paths";
import { useDocumentTitle } from "@/shared/hooks";
import { ButtonLink, Card, EmptyState } from "@/shared/ui";

export function ForbiddenPage() {
  useDocumentTitle("Sem acesso");
  return (
    <Card padding="lg">
      <EmptyState
        icon={Lock}
        title="Você não tem acesso a esta tela"
        description="Seu cargo não inclui a permissão necessária. Se precisar, peça ao administrador do painel."
        action={
          <ButtonLink to={PATHS.home} variant="secondary" icon={House}>
            Ir para o início
          </ButtonLink>
        }
      />
    </Card>
  );
}

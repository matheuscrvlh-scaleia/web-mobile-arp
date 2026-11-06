import { type Permission, permissionInfo } from "@arp/contracts";
import { House, Lock } from "lucide-react";
import { PATHS } from "@/shared/config/paths";
import { useDocumentTitle } from "@/shared/hooks";
import { ButtonLink, Card, EmptyState } from "@/shared/ui";

/** Sem acesso: diz qual permissão falta (com o nome da tela de cargos), para o TI resolver direto. */
export function ForbiddenPage({ permission }: { permission?: Permission }) {
  useDocumentTitle("Sem acesso");
  const info = permission ? permissionInfo(permission) : null;
  return (
    <Card padding="lg">
      <EmptyState
        icon={Lock}
        title="Você não tem acesso a esta tela"
        description={
          info
            ? `Seu cargo não inclui a permissão “${info.label}” (grupo ${info.group}). Peça ao administrador do painel para marcar no seu cargo, em Usuários e cargos.`
            : "Seu cargo não inclui a permissão necessária. Se precisar, peça ao administrador do painel."
        }
        action={
          <ButtonLink to={PATHS.home} variant="secondary" icon={House}>
            Ir para o início
          </ButtonLink>
        }
      />
    </Card>
  );
}

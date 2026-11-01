import type { LucideIcon } from "lucide-react";
import { isApiError } from "@/shared/api";
import { ButtonLink } from "./Button";
import { Card } from "./Card";
import { EmptyState, ErrorState } from "./EmptyState";

/**
 * Tela de um recurso que não carregou: sumiu (404, com o caminho de volta
 * para a lista) ou falhou (mensagem e "tentar de novo").
 */
export function LoadError({
  error,
  onRetry,
  icon,
  title,
  description = "Pode ter sido removido ou o endereço está errado.",
  back,
}: {
  error: unknown;
  onRetry: () => void;
  icon: LucideIcon;
  /** Título do 404 (ex.: "Campanha não encontrada"). */
  title: string;
  description?: string;
  /** Link para a lista (ex.: { to: PATHS.campaigns, label: "Ver campanhas" }). */
  back: { to: string; label: string };
}) {
  const notFound = isApiError(error) && error.status === 404;
  return (
    <Card padding="lg">
      {notFound ? (
        <EmptyState
          icon={icon}
          title={title}
          description={description}
          action={
            <ButtonLink to={back.to} variant="secondary">
              {back.label}
            </ButtonLink>
          }
        />
      ) : (
        <ErrorState error={error} onRetry={onRetry} />
      )}
    </Card>
  );
}

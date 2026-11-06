import { RotateCw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { isRouteErrorResponse, useRouteError } from "react-router";
import { avisarVersaoNova, Button } from "@/shared/ui";
import { NotFoundPage } from "./NotFoundPage";

/** Pedaço da tela que não baixou (deploy novo trocou os arquivos) ou erro de renderização. */
function isChunkError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(
      error.message,
    )
  );
}

/** Erro inesperado numa rota: a moldura continua de pé e dá para recarregar. */
export function RouteErrorPage() {
  const error = useRouteError();
  const chunk = isChunkError(error);
  // Versão nova no ar: quem pede para atualizar é o aviso do canto.
  useEffect(() => {
    if (chunk) avisarVersaoNova();
  }, [chunk]);
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  if (import.meta.env.DEV) console.error(error);
  if (chunk) {
    return (
      <p className="mx-auto my-10 max-w-lg text-center text-sm text-neutral-500">
        Esta tela é da versão nova do painel. Use o aviso no canto para atualizar.
      </p>
    );
  }
  return (
    <div role="alert" className="vidro mx-auto my-10 max-w-lg rounded-[2rem] p-8 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-red-500/15 text-red-700">
        <TriangleAlert className="size-5" aria-hidden />
      </span>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">Algo deu errado nesta tela</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Recarregue a página. Se continuar, avise o suporte com o que você estava fazendo.
      </p>
      <Button className="mt-6" icon={RotateCw} onClick={() => window.location.reload()}>
        Recarregar
      </Button>
    </div>
  );
}

import type { SyncSiteEventsResult } from "@arp/contracts";
import { ExternalLink, Globe, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useEventCategories, useSyncSiteEvents } from "@/features/events";
import { errorMessage } from "@/shared/api";
import { PATHS } from "@/shared/config/paths";
import { plural } from "@/shared/lib/format";
import {
  Button,
  ButtonLink,
  Card,
  CardHeader,
  Field,
  PageHeader,
  Select,
  toast,
} from "@/shared/ui";

const SITE_URL = "https://www.espacoarp.com.br";

/** "2 eventos novos, 1 atualizado, 0 apagados". */
function summary(r: SyncSiteEventsResult): string {
  const parts = [
    plural(r.created, "evento novo", "eventos novos"),
    plural(r.updated, "atualizado", "atualizados"),
    plural(r.removed, "apagado (saiu do site)", "apagados (saíram do site)"),
    r.failed > 0 && `${r.failed} sem data legível no site`,
  ].filter(Boolean);
  return parts.join(", ");
}

/** Integrações da plataforma com sistemas de fora. Hoje: a agenda do site. */
export function IntegrationsPage() {
  return (
    <>
      <PageHeader
        title="Integrações"
        description="Sistemas de fora que alimentam o app. O que vem deles não se edita aqui."
      />
      <SiteEventsCard />
    </>
  );
}

function SiteEventsCard() {
  const categories = useEventCategories();
  const sync = useSyncSiteEvents();
  const [categoryId, setCategoryId] = useState("");
  const [last, setLast] = useState<SyncSiteEventsResult | null>(null);
  const chosen = categoryId || categories.data?.[0]?.id || "";

  const run = () =>
    sync.mutate(
      { categoryId: chosen },
      {
        onSuccess: (r) => {
          setLast(r);
          toast.success(`Agenda sincronizada: ${summary(r)}.`);
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  return (
    <Card>
      <CardHeader
        icon={Globe}
        title="Agenda do site"
        description={
          <>
            Os eventos vêm de{" "}
            <a
              href={SITE_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-2"
            >
              espacoarp.com.br
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
            . Sincronizar deixa a agenda igual ao site: evento novo lá entra aqui fora do app;
            editado lá, muda aqui; apagado lá, é apagado aqui. Em Eventos você só escolhe o que
            aparece no app.
          </>
        }
      />
      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end">
        <Field
          label="Categoria dos eventos novos"
          hint="O site não tem categoria. Os que já existem mantêm a deles."
          className="sm:max-w-sm sm:flex-1"
        >
          <Select value={chosen} onChange={(e) => setCategoryId(e.target.value)}>
            {(categories.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button icon={RefreshCw} onClick={run} loading={sync.isPending} disabled={!chosen}>
            Sincronizar com o site
          </Button>
          <ButtonLink to={PATHS.events} variant="secondary">
            Ver eventos
          </ButtonLink>
        </div>
      </div>
      {last && (
        <output className="mt-4 block text-sm text-neutral-600">
          Última sincronização: {summary(last)}.
        </output>
      )}
    </Card>
  );
}

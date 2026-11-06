import { listAuditLogsQuerySchema } from "@arp/contracts";
import { FilterX, History, SearchX } from "lucide-react";
import { useCallback } from "react";
import { useSearchText, useUrlState } from "@/shared/hooks";
import {
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  Input,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  Skeleton,
} from "@/shared/ui";
import { useAuditActors, useAuditLogs } from "../api";
import { AuditEntry } from "../components/AuditEntry";
import { ENTITY_LABEL } from "../lib/describe";

// Um rótulo por tipo (o mapa tem sinônimos snake/camel para o mesmo tipo).
const ENTITY_OPTIONS = Object.entries(ENTITY_LABEL)
  .filter(
    ([key, label], i, all) =>
      !/[A-Z]/.test(key) &&
      !["session", "auth", "upload"].includes(key) &&
      all.findIndex(([, l]) => l === label) === i,
  )
  .sort(([, a], [, b]) => a.localeCompare(b, "pt-BR"));

const VERB_OPTIONS = [
  { value: "create", label: "Criou" },
  { value: "update", label: "Editou" },
  { value: "status", label: "Mudou a situação" },
  { value: "delete", label: "Excluiu" },
] as const;

export function AuditPage() {
  const [query, setQuery] = useUrlState(listAuditLogsQuerySchema);
  const commit = useCallback((q: string) => setQuery({ q }, { replace: true }), [setQuery]);
  const [search, setSearch] = useSearchText(query.q, commit);
  // Entradas no painel e envios de imagem são barulho: escondidos, salvo se pedir.
  const showAccess = query.hideAccess === "false";
  const logs = useAuditLogs({ ...query, hideAccess: showAccess ? undefined : "true" });
  const actors = useAuditActors();
  const filtered = Boolean(
    query.q ||
      query.verb ||
      query.entityType ||
      query.from ||
      query.to ||
      query.action ||
      query.entityId ||
      query.actorId,
  );

  return (
    <>
      <PageHeader
        title="Histórico"
        description="Tudo o que foi alterado no painel e no app: quem fez, quando e o que mudou."
      />
      <FilterBar className="items-end">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nome ou ação"
          label="Buscar no histórico"
          className="w-full sm:w-72"
        />
        <Field label="Tipo de item" className="w-full sm:w-52">
          <Select
            placeholder="Todos os itens"
            value={query.entityType ?? ""}
            onChange={(e) => setQuery({ entityType: e.target.value })}
          >
            {ENTITY_OPTIONS.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Quem" className="w-full sm:w-52">
          <Select
            placeholder="Qualquer pessoa"
            value={query.actorId ?? ""}
            onChange={(e) => setQuery({ actorId: e.target.value })}
          >
            {(actors.data?.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ação" className="w-full sm:w-44">
          <Select
            placeholder="Qualquer ação"
            value={query.verb ?? ""}
            onChange={(e) => setQuery({ verb: e.target.value })}
          >
            {VERB_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="De" className="w-full sm:w-40">
          <Input
            type="date"
            value={query.from ?? ""}
            max={query.to}
            onChange={(e) => setQuery({ from: e.target.value })}
          />
        </Field>
        <Field label="Até" className="w-full sm:w-40">
          <Input
            type="date"
            value={query.to ?? ""}
            min={query.from}
            onChange={(e) => setQuery({ to: e.target.value })}
          />
        </Field>
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            icon={FilterX}
            onClick={() => {
              setSearch("");
              setQuery({
                q: undefined,
                verb: undefined,
                entityType: undefined,
                from: undefined,
                to: undefined,
                action: undefined,
                entityId: undefined,
                actorId: undefined,
              });
            }}
          >
            Limpar filtros
          </Button>
        )}
        <Checkbox
          checked={showAccess}
          onChange={(e) => setQuery({ hideAccess: e.target.checked ? "false" : undefined })}
          className="min-h-11 items-center self-center"
          label="Mostrar entradas no painel"
        />
      </FilterBar>
      <Card>
        {logs.error ? (
          <ErrorState error={logs.error} onRetry={() => void logs.refetch()} />
        ) : !logs.data ? (
          <output aria-busy="true" className="flex flex-col gap-4 py-2">
            <span className="sr-only">Carregando histórico…</span>
            {Array.from({ length: 6 }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: linhas-esqueleto fixas
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-2/3 rounded-full" />
                  <Skeleton className="h-3 w-1/3 rounded-full" />
                </div>
              </div>
            ))}
          </output>
        ) : logs.data.data.length === 0 ? (
          filtered ? (
            <EmptyState compact icon={SearchX} title="Nada com esses filtros" />
          ) : (
            <EmptyState compact icon={History} title="Nenhuma alteração registrada ainda" />
          )
        ) : (
          <>
            <ol
              aria-label="Alterações, das mais novas para as mais antigas"
              aria-busy={logs.isFetching || undefined}
              className="flex flex-col divide-y divide-neutral-900/[0.06]"
            >
              {logs.data.data.map((log) => (
                <AuditEntry key={log.id} log={log} />
              ))}
            </ol>
            <Pagination meta={logs.data.meta} onPageChange={(page) => setQuery({ page })} />
          </>
        )}
      </Card>
    </>
  );
}

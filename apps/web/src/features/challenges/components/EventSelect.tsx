import { useState } from "react";
import { useEvents } from "@/features/events";
import { useDebouncedValue } from "@/shared/hooks";
import { formatIsoDay } from "@/shared/lib/format";
import { SearchInput, Select } from "@/shared/ui";

/**
 * Evento ligado ao desafio (opcional): busca pelo título e escolhe na
 * lista. O evento atual continua na lista mesmo fora da busca.
 */
export function EventSelect({
  value,
  current,
  onChange,
  disabled = false,
}: {
  value: string | null | undefined;
  /** Evento já salvo (para mostrar o nome sem depender da busca). */
  current: { id: string; title: string } | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search.trim(), 300);
  const events = useEvents({ q: q || undefined, pageSize: 30 }, { enabled: !disabled });
  const options = events.data?.data ?? [];
  const showCurrent = current && !options.some((e) => e.id === current.id);

  return (
    <div className="flex flex-col gap-2">
      {!disabled && (
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar evento pelo título"
          label="Buscar evento"
        />
      )}
      <Select
        placeholder="Nenhum evento"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || null)}
      >
        {showCurrent && <option value={current.id}>{current.title}</option>}
        {options.map((e) => (
          <option key={e.id} value={e.id}>
            {e.title} · {formatIsoDay(e.startsOn)}
            {e.status !== "published" ? " (não publicado)" : ""}
          </option>
        ))}
      </Select>
      {events.isFetching && (
        <span className="text-xs text-neutral-500" aria-live="polite">
          Buscando…
        </span>
      )}
    </div>
  );
}

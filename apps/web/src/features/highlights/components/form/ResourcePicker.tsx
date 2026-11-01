import { SearchInput, Select, Spinner } from "@/shared/ui";

export interface ResourceOption {
  id: string;
  label: string;
}

/**
 * Busca + lista para escolher o destino (evento, cupom, loja). O item já
 * escolhido continua na lista mesmo fora do resultado da busca.
 */
export function ResourcePicker({
  label,
  search,
  onSearch,
  options,
  value,
  selectedLabel,
  onChange,
  loading,
  placeholder,
  disabled,
}: {
  label: string;
  search: string;
  onSearch: (v: string) => void;
  options: ResourceOption[];
  value: string | null | undefined;
  /** Nome do item escolhido (quando não está nas opções carregadas). */
  selectedLabel: string | null | undefined;
  onChange: (id: string | null) => void;
  loading: boolean;
  placeholder: string;
  disabled?: boolean;
}) {
  const missing = value && !options.some((o) => o.id === value);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <SearchInput
          value={search}
          onChange={onSearch}
          placeholder={`Buscar ${label.toLowerCase()}`}
          label={`Buscar ${label.toLowerCase()}`}
          className="w-full sm:w-72"
        />
        {loading && <Spinner className="text-neutral-400" />}
      </div>
      <Select
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled}
      >
        {missing && <option value={value}>{selectedLabel ?? "Escolhido antes"}</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </Select>
      {!loading && options.length === 0 && (
        <p className="text-xs text-neutral-500">Nada encontrado com essa busca.</p>
      )}
    </div>
  );
}

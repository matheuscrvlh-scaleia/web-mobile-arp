import {
  IMPLIED_PERMISSIONS,
  PERMISSION_CATALOG,
  PERMISSIONS,
  type Permission,
  withImpliedPermissions,
} from "@arp/contracts";
import { Check, Lock } from "lucide-react";
// Atalho: a lista de telas vem do menu (fonte única); só leitura, sem React.
import { screensByPermission } from "@/app/navigation";
import { cn } from "@/shared/lib/cn";
import { CountPill } from "@/shared/ui";

const ALL = new Set<string>(PERMISSIONS);
const SCREENS = screensByPermission();

/** Quem inclui esta permissão (ex.: club.redeem vem com club.manage). */
function impliedBy(p: Permission, selected: ReadonlySet<Permission>): Permission | null {
  for (const [parent, children] of Object.entries(IMPLIED_PERMISSIONS)) {
    if (children?.includes(p) && selected.has(parent as Permission)) return parent as Permission;
  }
  return null;
}

const LABEL = new Map<string, string>(
  PERMISSION_CATALOG.flatMap((g) => g.items.map((i) => [i.key, i.label] as const)),
);

/** Telas do menu que o grupo libera ("Libera: Lojas, Mapa"). */
function screensOf(keys: readonly Permission[]): string[] {
  return [...new Set(keys.flatMap((k) => SCREENS.get(k) ?? []))];
}

/** "stores.manage" → "stores.view" (gerenciar sem ver não faz sentido). */
function viewOf(p: Permission): Permission | null {
  if (!p.endsWith(".manage")) return null;
  const v = `${p.slice(0, -".manage".length)}.view`;
  return ALL.has(v) ? (v as Permission) : null;
}
function manageOf(p: Permission): Permission | null {
  if (!p.endsWith(".view")) return null;
  const m = `${p.slice(0, -".view".length)}.manage`;
  return ALL.has(m) ? (m as Permission) : null;
}

/**
 * Permissões do cargo, agrupadas como no catálogo do contrato. Marcar
 * "gerenciar" marca o "ver" do mesmo assunto; desmarcar "ver" tira o
 * "gerenciar". Cargo do sistema: tudo marcado e travado.
 */
export function PermissionEditor({
  value,
  onChange,
  locked = false,
}: {
  value: Permission[];
  onChange: (next: Permission[]) => void;
  locked?: boolean;
}) {
  const selected = new Set(value);

  const toggle = (p: Permission, on: boolean) => {
    const next = new Set(selected);
    if (on) {
      next.add(p);
      const v = viewOf(p);
      if (v) next.add(v);
    } else {
      next.delete(p);
      const m = manageOf(p);
      if (m) next.delete(m);
    }
    onChange(PERMISSIONS.filter((x) => withImpliedPermissions([...next]).includes(x)));
  };

  const setGroup = (keys: Permission[], on: boolean) => {
    const next = new Set(selected);
    for (const k of keys) {
      if (on) next.add(k);
      else next.delete(k);
    }
    onChange(PERMISSIONS.filter((x) => withImpliedPermissions([...next]).includes(x)));
  };

  return (
    <div className="flex flex-col gap-4">
      {PERMISSION_CATALOG.map((group) => {
        const keys = group.items.map((i) => i.key) as Permission[];
        const count = keys.filter((k) => locked || selected.has(k)).length;
        const all = count === keys.length;
        const screens = screensOf(keys);
        return (
          <fieldset
            key={group.group}
            className="min-w-0 rounded-3xl border border-neutral-200 bg-white/60 p-4"
          >
            <legend className="sr-only">{group.group}</legend>
            <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-2 px-2">
              <span aria-hidden className="text-sm font-semibold">
                {group.group}
              </span>
              <CountPill active={count > 0}>
                {count} de {keys.length}
              </CountPill>
              {!locked && (
                <button
                  type="button"
                  onClick={() => setGroup(keys, !all)}
                  className="ml-auto cursor-pointer rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900"
                >
                  {all ? "Desmarcar todas" : "Marcar todas"}
                  <span className="sr-only"> de {group.group}</span>
                </button>
              )}
            </div>
            <p className="mb-3 px-2 text-xs text-neutral-500">
              {screens.length > 0
                ? `Libera: ${screens.join(", ")}`
                : "Libera ações dentro de outras telas"}
            </p>
            <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {group.items.map((item) => {
                const key = item.key as Permission;
                const on = locked || selected.has(key);
                const parent = locked ? null : impliedBy(key, selected);
                return (
                  <li key={key} className="min-w-0">
                    <label
                      className={cn(
                        "flex h-full items-start gap-3 rounded-2xl px-2 py-2 text-sm transition",
                        locked || parent ? "cursor-default" : "cursor-pointer hover:bg-neutral-100",
                        on && "bg-neutral-100/60",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={locked || Boolean(parent)}
                        onChange={(e) => toggle(key, e.target.checked)}
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden
                        className={cn(
                          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition peer-focus-visible:ring-4 peer-focus-visible:ring-neutral-900/15",
                          on
                            ? "border-neutral-900 bg-neutral-900 text-white"
                            : "border-neutral-300 bg-white",
                          (locked || parent) && "opacity-60",
                        )}
                      >
                        {locked ? (
                          <Lock className="size-3" />
                        ) : on ? (
                          <Check className="size-3" />
                        ) : null}
                      </span>
                      <span className="min-w-0">
                        {/* O código técnico (ex.: stores.view) fica só no tooltip, para o TI. */}
                        <span className="block text-neutral-800" title={key}>
                          {item.label}
                        </span>
                        <span className="block text-xs text-neutral-500">{item.description}</span>
                        {parent && (
                          <span className="block text-xs text-neutral-500">
                            Vem junto com “{LABEL.get(parent)}”.
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        );
      })}
    </div>
  );
}

/** Marca do painel: o trevo da ARP e o nome do sistema. */
export function Brand() {
  return (
    <span className="flex items-center gap-3">
      <img src="/brand/logo.png" alt="" width={40} height={40} className="size-10 rounded-xl" />
      <span className="leading-tight">
        <span className="block font-semibold text-neutral-900">ARP</span>
        <span className="block text-xs text-neutral-500">Gestor do app</span>
      </span>
    </span>
  );
}

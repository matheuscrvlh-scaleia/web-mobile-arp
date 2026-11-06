import { WifiOff } from "lucide-react";
import { useEffect, useRef } from "react";
import { useOnline } from "@/shared/hooks";
import { toast } from "./Toast";

/**
 * Faixa fixa no topo enquanto o navegador está sem internet. As listas se
 * atualizam sozinhas quando a rede volta (React Query); salvar sem rede
 * falha na hora com "nada foi salvo". Uma vez só, no AppShell.
 */
export function OfflineBanner() {
  const online = useOnline();
  const wasOffline = useRef(false);
  useEffect(() => {
    if (!online) wasOffline.current = true;
    else if (wasOffline.current) {
      wasOffline.current = false;
      toast.success("Conexão de volta.");
    }
  }, [online]);
  return (
    <div aria-live="polite" className="contents">
      {!online && (
        <div className="fixed inset-x-0 top-0 z-[85] flex justify-center px-3 pt-2 pointer-events-none">
          <p className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-[#1f1300] shadow-lg">
            <WifiOff className="size-4 shrink-0" aria-hidden />
            Sem conexão. Tentando de novo…
          </p>
        </div>
      )}
    </div>
  );
}

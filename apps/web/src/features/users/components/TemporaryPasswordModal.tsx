import { KeyRound, TriangleAlert } from "lucide-react";
import { Button, CopyButton, Modal } from "@/shared/ui";

/**
 * Senha provisória: aparece UMA vez (a API não guarda o texto). A pessoa
 * troca no primeiro acesso.
 */
export function TemporaryPasswordModal({
  password,
  userName,
  onClose,
  closeLabel = "Pronto, anotei",
}: {
  password: string | null;
  userName: string;
  onClose: () => void;
  closeLabel?: string;
}) {
  return (
    <Modal
      open={password !== null}
      onClose={onClose}
      size="sm"
      title={`Senha provisória de ${userName}`}
      description="Passe para a pessoa por um canal seguro. Ela vai criar uma senha própria no primeiro acesso."
      footer={<Button onClick={onClose}>{closeLabel}</Button>}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 rounded-2xl bg-neutral-900/[0.05] p-2 pl-4">
          <KeyRound className="size-4 shrink-0 text-neutral-500" aria-hidden />
          <code className="min-w-0 flex-1 font-mono text-lg font-semibold tracking-wider break-all select-all">
            {password}
          </code>
          {password && <CopyButton value={password} label="Copiar" />}
        </div>
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
          <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden />
          Esta senha não aparece de novo. Se perder, gere outra na página do usuário.
        </p>
      </div>
    </Modal>
  );
}

import { Smartphone } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button, Modal } from "@/shared/ui";

/**
 * Abaixo de xl a prévia lateral some: este botão a abre num painel.
 * Acima de xl ele nem aparece (a prévia fica ao lado do formulário).
 */
export function PreviewButton({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4 flex justify-end xl:hidden">
      <Button variant="secondary" size="sm" icon={Smartphone} onClick={() => setOpen(true)}>
        Ver prévia
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        size="sm"
        footer={
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Fechar
          </Button>
        }
      >
        <div className="mx-auto w-full max-w-[20rem]">{children}</div>
      </Modal>
    </div>
  );
}

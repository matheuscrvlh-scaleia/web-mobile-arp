import { PATHS } from "@/shared/config/paths";
import { PageHeader } from "@/shared/ui";
import { NotificationForm } from "../components/NotificationForm";

export function NotificationCreatePage() {
  return (
    <>
      <PageHeader
        title="Nova notificação"
        description="Escreva, veja como chega no celular e envie agora ou agende."
        back={{ to: PATHS.notifications, label: "Notificações" }}
      />
      <NotificationForm />
    </>
  );
}

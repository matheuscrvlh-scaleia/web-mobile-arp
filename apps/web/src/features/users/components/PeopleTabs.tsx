import { ShieldCheck, Users } from "lucide-react";
import { PATHS } from "@/shared/config/paths";
import { NavTabs } from "@/shared/ui";

/** Usuários | Cargos: telas irmãs da administração de acesso. */
export function PeopleTabs() {
  return (
    <NavTabs
      label="Acesso ao painel"
      items={[
        { to: PATHS.users, label: "Usuários", icon: Users },
        { to: PATHS.roles, label: "Cargos", icon: ShieldCheck },
      ]}
    />
  );
}

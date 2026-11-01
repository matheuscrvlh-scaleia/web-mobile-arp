import type { Permission } from "@arp/contracts";
import { Navigate, Outlet, useLocation, useSearchParams } from "react-router";
import { useAuth } from "@/shared/auth";
import { PATHS } from "@/shared/config/paths";
import { safeNextPath } from "@/shared/lib/text";
import { EmptyState } from "@/shared/ui";
import { homePathFor } from "./navigation";
import { ForbiddenPage } from "./pages/ForbiddenPage";
import { SplashScreen } from "./pages/SplashScreen";

/** Só logado. Sem sessão, vai ao login e volta para cá depois (?next=). */
export function RequireAuth() {
  const { status, user, signedOutReason } = useAuth();
  const location = useLocation();
  if (status === "loading") return <SplashScreen />;
  if (status === "anonymous" || !user) {
    const next = `${location.pathname}${location.search}`;
    const params = new URLSearchParams();
    // Saiu de propósito: o próximo login começa do início.
    if (next !== "/" && signedOutReason !== "signed-out") params.set("next", next);
    if (signedOutReason === "expired") params.set("motivo", "expirou");
    const qs = params.toString();
    return <Navigate to={`${PATHS.login}${qs ? `?${qs}` : ""}`} replace />;
  }
  // Senha provisória: troca antes de qualquer outra tela.
  if (user.mustChangePassword && location.pathname !== PATHS.changePassword) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`${PATHS.changePassword}?next=${encodeURIComponent(next)}`} replace />;
  }
  return <Outlet />;
}

/** Tela de quem ainda não entrou (login). Logado, segue para onde ia. */
export function GuestOnly() {
  const { status, user } = useAuth();
  const [params] = useSearchParams();
  if (status === "loading") return <SplashScreen />;
  if (status === "authenticated" && user) {
    const next = safeNextPath(params.get("next")) ?? homePathFor(user) ?? PATHS.home;
    return <Navigate to={next} replace />;
  }
  return <Outlet />;
}

/** Rota que exige uma permissão (a da rota da API que a tela usa). */
export function RequirePermission({ permission }: { permission: Permission }) {
  const { can } = useAuth();
  return can(permission) ? <Outlet /> : <ForbiddenPage />;
}

/** "/" leva à primeira tela do menu da pessoa. */
export function HomeRedirect() {
  const { user } = useAuth();
  const home = user ? homePathFor(user) : null;
  if (home && home !== PATHS.home) return <Navigate to={home} replace />;
  return (
    <EmptyState
      title="Nenhuma tela liberada"
      description="Seu cargo ainda não tem acesso a nenhuma tela. Fale com o administrador do painel."
    />
  );
}

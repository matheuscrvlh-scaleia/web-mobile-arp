import type {
  SignedAccessToken,
  TokenService,
} from "../../../shared/application/ports/token-service";
import type { StaffProfile } from "../domain/repositories";

/** Access token do painel com o cargo e a loja atuais do usuário. */
export function signStaffToken(
  tokens: TokenService,
  profile: StaffProfile,
  sessionFamilyId: string,
): Promise<SignedAccessToken> {
  return tokens.signAccessToken({
    audience: "admin",
    subject: profile.id,
    sessionId: sessionFamilyId,
    name: profile.name,
    roleId: profile.roleId,
    permissions: profile.permissions,
    storeId: profile.storeId,
  });
}

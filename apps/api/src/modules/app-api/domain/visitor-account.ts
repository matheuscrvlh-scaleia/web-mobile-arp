export type VisitorStatus = "active" | "blocked";
/** Método de login da conta (um só por conta). */
export type AuthProvider = "password" | "google" | "apple";
export type SocialProvider = Exclude<AuthProvider, "password">;

export interface VisitorAccountProps {
  id: string;
  name: string;
  email: string;
  /** null em contas de login social (Google/Apple). */
  passwordHash: string | null;
  authProvider: AuthProvider;
  status: VisitorStatus;
}

export interface NewVisitorAccount {
  name: string;
  email: string;
  phone: string | null;
  passwordHash: string;
  marketingOptIn: boolean;
  termsAcceptedAt: Date;
}

export interface VisitorProfileChanges {
  name?: string;
  phone?: string | null;
  marketingOptIn?: boolean;
}

/** Conta nova pelo login social (sem senha; identificada pelo "sub" do provedor). */
export interface NewSocialVisitorAccount {
  name: string;
  email: string;
  provider: SocialProvider;
  providerSubject: string;
  marketingOptIn: boolean;
  termsAcceptedAt: Date;
}

/** Conta do visitante do ponto de vista da autenticação do app. */
export class VisitorAccount {
  private constructor(private readonly props: VisitorAccountProps) {}

  static restore(props: VisitorAccountProps): VisitorAccount {
    return new VisitorAccount({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get email(): string {
    return this.props.email;
  }
  get authProvider(): AuthProvider {
    return this.props.authProvider;
  }
  get passwordHash(): string | null {
    return this.props.passwordHash;
  }
  get isActive(): boolean {
    return this.props.status === "active";
  }
}

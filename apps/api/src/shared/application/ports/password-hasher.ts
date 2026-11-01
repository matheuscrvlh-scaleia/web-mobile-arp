export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  /** Comparação em tempo constante; hash malformado devolve false. */
  verify(hash: string, plain: string): Promise<boolean>;
}

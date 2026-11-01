/** Aleatoriedade criptográfica (códigos de cupom, tokens de QR, senhas provisórias). */
export interface SecureRandom {
  /** Inteiro uniforme em [0, max). */
  int(max: number): number;
  /** Token url-safe com `bytes` bytes de entropia. */
  token(bytes: number): string;
  /** Texto com `length` caracteres sorteados do alfabeto. */
  string(alphabet: string, length: number): string;
}

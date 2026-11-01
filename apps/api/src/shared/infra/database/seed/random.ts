/**
 * PRNG com semente fixa (sfc32): a mesma semente e o mesmo "agora" geram
 * exatamente os mesmos dados de demonstração. Não use para nada de segurança
 * (tokens de QR usam node:crypto).
 */
export class Random {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number) {
    this.a = 0x9e3779b9;
    this.b = 0x243f6a88;
    this.c = 0xb7e15162;
    this.d = seed >>> 0;
    for (let i = 0; i < 16; i++) this.next();
  }

  /** [0, 1) */
  next(): number {
    this.a >>>= 0;
    this.b >>>= 0;
    this.c >>>= 0;
    this.d >>>= 0;
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return (t >>> 0) / 4294967296;
  }

  /** Inteiro em [min, max]. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("pick em lista vazia");
    return items[Math.floor(this.next() * items.length)] as T;
  }

  /** Item sorteado proporcionalmente ao peso. */
  weighted<T>(items: readonly (readonly [T, number])[]): T {
    const total = items.reduce((s, [, w]) => s + w, 0);
    let r = this.next() * total;
    for (const [item, weight] of items) {
      r -= weight;
      if (r < 0) return item;
    }
    return (items.at(-1) as readonly [T, number])[0];
  }

  /** n itens distintos (ordem aleatória). */
  sample<T>(items: readonly T[], n: number): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
    }
    return copy.slice(0, Math.max(0, Math.min(n, copy.length)));
  }

  /** Caracteres do alfabeto informado. */
  string(alphabet: string, length: number): string {
    let out = "";
    for (let i = 0; i < length; i++) out += alphabet[Math.floor(this.next() * alphabet.length)];
    return out;
  }

  /**
   * UUID v7 com o timestamp de `at` (não o de agora): dados históricos ficam
   * com ids na mesma ordem de created_at, como se tivessem sido criados na época.
   */
  uuidV7At(at: Date): string {
    const hex = (bits: number) =>
      Array.from({ length: bits / 4 }, () => Math.floor(this.next() * 16).toString(16)).join("");
    const ts = Math.max(0, Math.floor(at.getTime())).toString(16).padStart(12, "0").slice(-12);
    const variant = (8 + Math.floor(this.next() * 4)).toString(16);
    return `${ts.slice(0, 8)}-${ts.slice(8, 12)}-7${hex(12)}-${variant}${hex(12)}-${hex(48)}`;
  }
}

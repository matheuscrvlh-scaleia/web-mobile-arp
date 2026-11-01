import type { MerchantAccount } from "./merchant";

export interface MerchantAccountRepository {
  findByEmail(email: string): Promise<MerchantAccount | null>;
  findById(id: string): Promise<MerchantAccount | null>;
  recordLogin(id: string, at: Date): Promise<void>;
}

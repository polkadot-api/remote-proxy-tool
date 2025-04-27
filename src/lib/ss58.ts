import { AccountId } from "polkadot-api";

export const accId = AccountId();
export const genericSS58 = (v: string) => accId.dec(accId.enc(v));

import { StrKey, Networks, TransactionBuilder, Transaction } from '@stellar/stellar-base';

export const STELLAR_NETWORKS = {
  PUBLIC: Networks.PUBLIC,
  TESTNET: Networks.TESTNET,
};

export function isValidStellarPublicKey(key: string): boolean {
  if (typeof key !== 'string') return false;
  return StrKey.isValidEd25519PublicKey(key);
}

export function parseChallengeTransaction(
  xdr: string,
  networkPassphrase: string = Networks.PUBLIC
): Transaction | null {
  try {
    const tx = TransactionBuilder.fromXDR(xdr, networkPassphrase);
    if (tx instanceof Transaction) {
      return tx;
    }
    return null;
  } catch {
    return null;
  }
}

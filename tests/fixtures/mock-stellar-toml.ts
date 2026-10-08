import { Account, Keypair, Networks, Operation, TransactionBuilder } from '@stellar/stellar-base';

export const VALID_STELLAR_TOML = `
VERSION = "2.0.0"
NETWORK_PASSPHRASE = "Public Global Stellar Network ; September 2015"
SIGNING_KEY = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
AUTH_SERVER = "https://anchor.example.com/auth"
TRANSFER_SERVER_SEP0024 = "https://anchor.example.com/sep24"
TRANSFER_SERVER = "https://anchor.example.com/sep6"
ANCHOR_QUOTE_SERVER = "https://anchor.example.com/sep38"

[DOCUMENTATION]
ORG_NAME = "Example Anchor Inc."
ORG_URL = "https://example.com"
ORG_OFFICIAL_EMAIL = "support@example.com"

[[CURRENCIES]]
code = "USDC"
issuer = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
is_unlimited = true
`;

export function generateMockSep10Challenge(): string {
  const serverKeypair = Keypair.random();
  const clientKeypair = Keypair.random();

  const account = new Account(serverKeypair.publicKey(), '-1');

  const now = Math.floor(Date.now() / 1000);
  const tx = new TransactionBuilder(account as any, {
    fee: '100',
    networkPassphrase: Networks.PUBLIC,
    timebounds: {
      minTime: now,
      maxTime: now + 300,
    },
  })
    .addOperation(
      Operation.manageData({
        name: 'example.com auth',
        value: Buffer.alloc(48, 1),
        source: clientKeypair.publicKey(),
      })
    )
    .build();

  tx.sign(serverKeypair);
  return tx.toEnvelope().toXDR('base64');
}

export const VALID_SEP24_INFO = {
  deposit: {
    USDC: {
      enabled: true,
      min_amount: 1,
      max_amount: 10000,
      fee_fixed: 0.5,
      fee_percent: 0.1,
    },
  },
  withdraw: {
    USDC: {
      enabled: true,
      min_amount: 5,
      max_amount: 5000,
      fee_fixed: 1.0,
      fee_percent: 0.2,
    },
  },
  fee: {
    enabled: true,
  },
};

export const VALID_SEP38_INFO = {
  assets: [
    {
      asset: 'stellar:USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
      country_codes: ['USA'],
      sell_delivery_methods: [{ name: 'ACH', description: 'Direct Deposit' }],
      buy_delivery_methods: [{ name: 'ACH', description: 'Direct Debit' }],
    },
  ],
};

export const VALID_SEP6_INFO = {
  deposit: {
    USDC: {
      enabled: true,
      min_amount: 1,
      max_amount: 10000,
    },
  },
  withdraw: {
    USDC: {
      enabled: true,
      min_amount: 5,
      max_amount: 5000,
    },
  },
};

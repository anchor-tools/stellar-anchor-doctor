import { parse } from 'smol-toml';
import { CheckContext, DiagnosticCheck, DiagnosticFinding } from '../types.js';
import { safeFetch } from '../utils/http.js';
import { isValidStellarPublicKey, STELLAR_NETWORKS } from '../utils/stellar.js';

export const sep1Check: DiagnosticCheck = {
  id: 'sep-1',
  name: 'SEP-0001: Stellar Info File (stellar.toml)',
  category: 'SEP-0001',
  description: 'Validates presence, CORS, Content-Type, and structure of /.well-known/stellar.toml',
  specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md',

  async run(context: CheckContext): Promise<DiagnosticFinding[]> {
    const findings: DiagnosticFinding[] = [];
    const url = `https://${context.domain}/.well-known/stellar.toml`;
    context.endpoints.stellarTomlUrl = url;

    const res = await safeFetch(url, { method: 'GET' }, context.timeoutMs, context.fetchFn);

    if (!res.ok) {
      findings.push({
        id: 'sep1-missing',
        category: 'SEP-0001',
        severity: 'error',
        title: 'stellar.toml Not Accessible',
        message: `Failed to fetch ${url} (HTTP ${res.status} ${res.statusText || res.error || ''})`,
        specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md',
        remediation: `Ensure that https://${context.domain}/.well-known/stellar.toml is publicly accessible over HTTPS.`,
      });
      return findings;
    }

    findings.push({
      id: 'sep1-accessible',
      category: 'SEP-0001',
      severity: 'pass',
      title: 'stellar.toml Discovered',
      message: `Successfully loaded stellar.toml (${res.data.length} bytes in ${res.durationMs}ms)`,
      specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md',
    });

    // CORS check
    const acao = res.headers.get('access-control-allow-origin');
    if (!acao || acao !== '*') {
      findings.push({
        id: 'sep1-cors',
        category: 'SEP-0001',
        severity: 'warn',
        title: 'Missing or Non-Wildcard CORS Header',
        message: `stellar.toml returned Access-Control-Allow-Origin: '${acao || 'none'}', expected '*'`,
        specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md#cors',
        remediation: 'Configure your web server to return `Access-Control-Allow-Origin: *` for /.well-known/stellar.toml so browser wallets can read it.',
      });
    } else {
      findings.push({
        id: 'sep1-cors',
        category: 'SEP-0001',
        severity: 'pass',
        title: 'CORS Header Valid',
        message: 'Access-Control-Allow-Origin is set to *',
      });
    }

    // Content-Type check
    const contentType = res.contentType || '';
    if (!contentType.includes('text/plain') && !contentType.includes('application/toml')) {
      findings.push({
        id: 'sep1-content-type',
        category: 'SEP-0001',
        severity: 'warn',
        title: 'Non-Standard Content-Type',
        message: `Returned Content-Type: '${contentType}'. SEP-1 recommends 'text/plain; charset=utf-8'`,
        specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md',
        remediation: 'Set the Content-Type header of stellar.toml to `text/plain; charset=utf-8`.',
      });
    } else {
      findings.push({
        id: 'sep1-content-type',
        category: 'SEP-0001',
        severity: 'pass',
        title: 'Content-Type Valid',
        message: `Content-Type is '${contentType}'`,
      });
    }

    // Parse TOML
    let parsed: any;
    try {
      parsed = parse(res.data);
      context.tomlData = parsed;
    } catch (parseErr: any) {
      findings.push({
        id: 'sep1-syntax',
        category: 'SEP-0001',
        severity: 'error',
        title: 'Invalid TOML Syntax',
        message: `Failed to parse stellar.toml: ${parseErr.message}`,
        specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md',
        remediation: 'Fix syntax errors in your TOML file. Ensure string quotes and tables are formatted correctly.',
      });
      return findings;
    }

    findings.push({
      id: 'sep1-syntax',
      category: 'SEP-0001',
      severity: 'pass',
      title: 'Valid TOML Syntax',
      message: 'stellar.toml parsed successfully without syntax errors',
    });

    // Check NETWORK_PASSPHRASE
    const expectedPassphrase = context.isTestnet
      ? STELLAR_NETWORKS.TESTNET
      : STELLAR_NETWORKS.PUBLIC;

    if (!parsed.NETWORK_PASSPHRASE) {
      findings.push({
        id: 'sep1-passphrase',
        category: 'SEP-0001',
        severity: 'warn',
        title: 'Missing NETWORK_PASSPHRASE',
        message: 'NETWORK_PASSPHRASE is not specified in stellar.toml',
        remediation: `Add NETWORK_PASSPHRASE = "${expectedPassphrase}" to your stellar.toml.`,
      });
    } else if (parsed.NETWORK_PASSPHRASE !== expectedPassphrase) {
      findings.push({
        id: 'sep1-passphrase',
        category: 'SEP-0001',
        severity: 'error',
        title: 'Mismatching NETWORK_PASSPHRASE',
        message: `Found NETWORK_PASSPHRASE = "${parsed.NETWORK_PASSPHRASE}", expected "${expectedPassphrase}"`,
        remediation: `Update NETWORK_PASSPHRASE in stellar.toml to match the target network.`,
      });
    } else {
      context.endpoints.networkPassphrase = parsed.NETWORK_PASSPHRASE;
      findings.push({
        id: 'sep1-passphrase',
        category: 'SEP-0001',
        severity: 'pass',
        title: 'NETWORK_PASSPHRASE Valid',
        message: `Matches ${context.isTestnet ? 'Testnet' : 'Public'} passphrase exactly`,
      });
    }

    // Check SIGNING_KEY
    if (parsed.SIGNING_KEY) {
      context.endpoints.signingKey = parsed.SIGNING_KEY;
      if (isValidStellarPublicKey(parsed.SIGNING_KEY)) {
        findings.push({
          id: 'sep1-signing-key',
          category: 'SEP-0001',
          severity: 'pass',
          title: 'SIGNING_KEY Valid',
          message: `Stellar Ed25519 public key passes CRC16 checksum verification (${parsed.SIGNING_KEY})`,
        });
      } else {
        findings.push({
          id: 'sep1-signing-key',
          category: 'SEP-0001',
          severity: 'error',
          title: 'Invalid SIGNING_KEY',
          message: `SIGNING_KEY "${parsed.SIGNING_KEY}" is not a valid Stellar public key or has an invalid checksum`,
          remediation: 'Provide a valid 56-character Ed25519 public key starting with G.',
        });
      }
    } else {
      findings.push({
        id: 'sep1-signing-key',
        category: 'SEP-0001',
        severity: 'info',
        title: 'No SIGNING_KEY Defined',
        message: 'SIGNING_KEY is recommended for SEP-10 authentication and signing verification.',
        remediation: 'Add SIGNING_KEY to stellar.toml to enable cryptographic verification of your anchor.',
      });
    }

    // Discover server endpoints
    if (parsed.AUTH_SERVER) {
      context.endpoints.authServerUrl = parsed.AUTH_SERVER;
      findings.push({
        id: 'sep1-endpoint-auth',
        category: 'SEP-0001',
        severity: 'info',
        title: 'Discovered AUTH_SERVER',
        message: `SEP-10 Auth Server: ${parsed.AUTH_SERVER}`,
      });
    }

    if (parsed.TRANSFER_SERVER_SEP0024) {
      context.endpoints.transferServerSep24Url = parsed.TRANSFER_SERVER_SEP0024;
      findings.push({
        id: 'sep1-endpoint-sep24',
        category: 'SEP-0001',
        severity: 'info',
        title: 'Discovered TRANSFER_SERVER_SEP0024',
        message: `SEP-24 Hosted Deposit/Withdrawal Server: ${parsed.TRANSFER_SERVER_SEP0024}`,
      });
    }

    if (parsed.TRANSFER_SERVER) {
      context.endpoints.transferServerSep6Url = parsed.TRANSFER_SERVER;
      findings.push({
        id: 'sep1-endpoint-sep6',
        category: 'SEP-0001',
        severity: 'info',
        title: 'Discovered TRANSFER_SERVER (SEP-6)',
        message: `SEP-6 Transfer Server: ${parsed.TRANSFER_SERVER}`,
      });
    }

    if (parsed.ANCHOR_QUOTE_SERVER) {
      context.endpoints.anchorQuoteServerUrl = parsed.ANCHOR_QUOTE_SERVER;
      findings.push({
        id: 'sep1-endpoint-sep38',
        category: 'SEP-0001',
        severity: 'info',
        title: 'Discovered ANCHOR_QUOTE_SERVER (SEP-38)',
        message: `SEP-38 RFQ Quote Server: ${parsed.ANCHOR_QUOTE_SERVER}`,
      });
    }

    if (parsed.KYC_SERVER) {
      context.endpoints.kycServerUrl = parsed.KYC_SERVER;
    }

    // Check CURRENCIES array
    if (Array.isArray(parsed.CURRENCIES) && parsed.CURRENCIES.length > 0) {
      for (const [idx, cur] of parsed.CURRENCIES.entries()) {
        const code = cur.code || '';
        if (!code) {
          findings.push({
            id: `sep1-cur-${idx}-code`,
            category: 'SEP-0001',
            severity: 'error',
            title: `CURRENCIES[${idx}] Missing Code`,
            message: 'Each entry in [[CURRENCIES]] must declare a `code`.',
          });
        }

        if (cur.issuer && !isValidStellarPublicKey(cur.issuer)) {
          findings.push({
            id: `sep1-cur-${idx}-issuer`,
            category: 'SEP-0001',
            severity: 'error',
            title: `CURRENCIES[${idx}] (${code}) Invalid Issuer`,
            message: `Issuer '${cur.issuer}' failed Stellar public key CRC16 checksum.`,
            remediation: 'Check for transcription typos in the issuer address.',
          });
        }
      }

      findings.push({
        id: 'sep1-currencies',
        category: 'SEP-0001',
        severity: 'pass',
        title: 'Currencies Declared',
        message: `Declared ${parsed.CURRENCIES.length} currency definitions in [[CURRENCIES]]`,
      });
    }

    // Check DOCUMENTATION table
    if (parsed.DOCUMENTATION) {
      if (parsed.DOCUMENTATION.ORG_NAME && parsed.DOCUMENTATION.ORG_URL) {
        findings.push({
          id: 'sep1-documentation',
          category: 'SEP-0001',
          severity: 'pass',
          title: 'Organization Documentation Present',
          message: `Organization: ${parsed.DOCUMENTATION.ORG_NAME} (${parsed.DOCUMENTATION.ORG_URL})`,
        });
      }
    } else {
      findings.push({
        id: 'sep1-documentation',
        category: 'SEP-0001',
        severity: 'warn',
        title: 'Missing [DOCUMENTATION] Table',
        message: 'Anchor documentation table with ORG_NAME, ORG_URL, and ORG_LOGO is recommended.',
        remediation: 'Add [DOCUMENTATION] section with ORG_NAME and ORG_URL.',
      });
    }

    return findings;
  },
};

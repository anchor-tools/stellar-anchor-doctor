import { CheckContext, DiagnosticCheck, DiagnosticFinding } from '../types.js';
import { safeFetch } from '../utils/http.js';
import { parseChallengeTransaction, STELLAR_NETWORKS } from '../utils/stellar.js';

// Standard well-known testing public key
const TEST_CLIENT_ACCOUNT = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

export const sep10Check: DiagnosticCheck = {
  id: 'sep-10',
  name: 'SEP-0010: Stellar Web Authentication',
  category: 'SEP-0010',
  description: 'Validates AUTH_SERVER endpoint, CORS, challenge transaction sequence, timebounds, and signatures',
  specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md',

  async run(context: CheckContext): Promise<DiagnosticFinding[]> {
    const findings: DiagnosticFinding[] = [];
    const authUrl = context.endpoints.authServerUrl;

    if (!authUrl) {
      findings.push({
        id: 'sep10-not-configured',
        category: 'SEP-0010',
        severity: 'info',
        title: 'AUTH_SERVER Not Configured',
        message: 'No AUTH_SERVER declared in stellar.toml; skipping SEP-10 authentication diagnostics.',
        specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md',
      });
      return findings;
    }

    // 1. Request challenge transaction
    const challengeUrl = `${authUrl}${authUrl.includes('?') ? '&' : '?'}account=${TEST_CLIENT_ACCOUNT}`;
    const res = await safeFetch(challengeUrl, { method: 'GET' }, context.timeoutMs, context.fetchFn);

    if (!res.ok) {
      findings.push({
        id: 'sep10-endpoint-fail',
        category: 'SEP-0010',
        severity: 'error',
        title: 'AUTH_SERVER Failed Challenge Request',
        message: `GET ${challengeUrl} failed with HTTP ${res.status} ${res.statusText || res.error || ''}`,
        specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md',
        remediation: 'Ensure the AUTH_SERVER endpoint is responding to challenge requests with `account` parameter.',
      });
      return findings;
    }

    findings.push({
      id: 'sep10-endpoint-online',
      category: 'SEP-0010',
      severity: 'pass',
      title: 'AUTH_SERVER Responding',
      message: `Successfully received response from ${authUrl} (${res.durationMs}ms)`,
    });

    // 2. CORS header check
    const acao = res.headers.get('access-control-allow-origin');
    if (!acao || acao !== '*') {
      findings.push({
        id: 'sep10-cors',
        category: 'SEP-0010',
        severity: 'warn',
        title: 'AUTH_SERVER Missing Wildcard CORS',
        message: `Access-Control-Allow-Origin: '${acao || 'none'}'. Browser wallets require '*' to perform authentication.`,
        specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md#cors',
        remediation: 'Set `Access-Control-Allow-Origin: *` on your AUTH_SERVER responses.',
      });
    } else {
      findings.push({
        id: 'sep10-cors',
        category: 'SEP-0010',
        severity: 'pass',
        title: 'AUTH_SERVER CORS Allowed',
        message: 'Access-Control-Allow-Origin is set to *',
      });
    }

    // 3. Parse JSON response
    let json: any;
    try {
      json = JSON.parse(res.data);
    } catch {
      findings.push({
        id: 'sep10-response-json',
        category: 'SEP-0010',
        severity: 'error',
        title: 'Invalid JSON Response',
        message: 'AUTH_SERVER did not return valid JSON.',
        specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md',
      });
      return findings;
    }

    if (!json.transaction) {
      findings.push({
        id: 'sep10-transaction-field',
        category: 'SEP-0010',
        severity: 'error',
        title: 'Missing "transaction" Field',
        message: 'AUTH_SERVER response JSON must contain a "transaction" key with the base64 challenge XDR.',
        specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md',
      });
      return findings;
    }

    // 4. Validate Challenge Transaction XDR
    const networkPassphrase =
      context.endpoints.networkPassphrase ||
      (context.isTestnet ? STELLAR_NETWORKS.TESTNET : STELLAR_NETWORKS.PUBLIC);

    const tx = parseChallengeTransaction(json.transaction, networkPassphrase);

    if (!tx) {
      findings.push({
        id: 'sep10-xdr-parse',
        category: 'SEP-0010',
        severity: 'error',
        title: 'Invalid Challenge Transaction XDR',
        message: 'Unable to decode base64 challenge transaction or network passphrase mismatch.',
        specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md',
        remediation: `Verify that the challenge transaction is valid XDR built for "${networkPassphrase}".`,
      });
      return findings;
    }

    findings.push({
      id: 'sep10-xdr-valid',
      category: 'SEP-0010',
      severity: 'pass',
      title: 'Valid Challenge Transaction XDR',
      message: `Parsed transaction envelope successfully with source ${tx.source}`,
    });

    // 5. Sequence Number Check (MUST be 0)
    if (tx.sequence !== '0') {
      findings.push({
        id: 'sep10-sequence-zero',
        category: 'SEP-0010',
        severity: 'error',
        title: 'Sequence Number Must Be 0',
        message: `Challenge transaction sequence is "${tx.sequence}", but SEP-10 requires sequence number to be "0".`,
        specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md#challenge-transaction',
        remediation: 'Ensure the challenge transaction is created with sequence number 0 so it cannot be submitted on-chain.',
      });
    } else {
      findings.push({
        id: 'sep10-sequence-zero',
        category: 'SEP-0010',
        severity: 'pass',
        title: 'Sequence Number Valid',
        message: 'Challenge transaction sequence number is 0',
      });
    }

    // 6. Timebounds Check
    if (!tx.timeBounds) {
      findings.push({
        id: 'sep10-timebounds',
        category: 'SEP-0010',
        severity: 'error',
        title: 'Missing Timebounds',
        message: 'Challenge transaction must contain timebounds with minTime and maxTime.',
        specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md#challenge-transaction',
        remediation: 'Set valid timebounds on the challenge transaction (recommended: 300 seconds window).',
      });
    } else {
      const minTime = Number(tx.timeBounds.minTime);
      const maxTime = Number(tx.timeBounds.maxTime);
      const duration = maxTime - minTime;

      if (duration > 900) {
        findings.push({
          id: 'sep10-timebounds-duration',
          category: 'SEP-0010',
          severity: 'warn',
          title: 'Excessive Timebounds Grace Period',
          message: `Challenge timebound window is ${duration}s. SEP-10 recommends ~300s (max 900s) to prevent replay vulnerabilities.`,
          specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md',
        });
      } else {
        findings.push({
          id: 'sep10-timebounds-valid',
          category: 'SEP-0010',
          severity: 'pass',
          title: 'Timebounds Valid',
          message: `Timebounds window is ${duration}s (${new Date(minTime * 1000).toISOString()} to ${new Date(maxTime * 1000).toISOString()})`,
        });
      }
    }

    // 7. Operations Check (Manage Data)
    const ops = tx.operations || [];
    const manageDataOps = ops.filter((op: any) => op.type === 'manageData');

    if (manageDataOps.length === 0) {
      findings.push({
        id: 'sep10-manage-data',
        category: 'SEP-0010',
        severity: 'error',
        title: 'Missing Manage Data Operation',
        message: 'Challenge transaction must contain at least one Manage Data operation with home domain and nonce.',
        specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md',
        remediation: 'Add a manageData operation with `<home_domain> auth` and a 48-byte cryptographically random nonce value.',
      });
    } else {
      findings.push({
        id: 'sep10-manage-data',
        category: 'SEP-0010',
        severity: 'pass',
        title: 'Manage Data Operation Present',
        message: `Found ${manageDataOps.length} Manage Data operation(s) in challenge transaction`,
      });
    }

    // 8. Signatures Check (Server signature must exist)
    const sigs = tx.signatures || [];
    if (sigs.length === 0) {
      findings.push({
        id: 'sep10-signatures',
        category: 'SEP-0010',
        severity: 'error',
        title: 'Missing Server Signature',
        message: 'Challenge transaction must be pre-signed by the server signing key.',
        specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md#challenge-transaction',
        remediation: 'Sign the challenge transaction with the anchor server private key before sending to client.',
      });
    } else {
      findings.push({
        id: 'sep10-signatures',
        category: 'SEP-0010',
        severity: 'pass',
        title: 'Server Signature Present',
        message: `Challenge transaction contains ${sigs.length} server signature(s)`,
      });
    }

    return findings;
  },
};

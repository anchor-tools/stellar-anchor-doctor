import type { Transaction } from '@stellar/stellar-base';
import { CheckContext, DiagnosticCheck, DiagnosticFinding } from '../types.js';
import { SafeFetchResult, safeFetch } from '../utils/http.js';
import { parseChallengeTransaction, STELLAR_NETWORKS } from '../utils/stellar.js';

const SEP10_SPEC_URL =
  'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md';

// Standard well-known testing public key
const TEST_CLIENT_ACCOUNT = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

/**
 * Client domain sent with the structural SEP-10 client-domain probe.
 *
 * SEP-10 only adds the `client_domain` Manage Data operation when the server
 * supports client-domain verification, and the operation's source account is
 * the SIGNING_KEY published by that client domain. This tool has no wallet
 * signing key, so it probes with a reserved `.example` domain (RFC 2606) and
 * validates the returned challenge structure only. See the limitations below.
 */
export const TEST_CLIENT_DOMAIN = 'anchor-doctor.example';

const CLIENT_DOMAIN_PARAM = 'client_domain';
const CLIENT_DOMAIN_MANAGE_DATA_KEY = 'client_domain';

function buildChallengeUrl(authUrl: string, params: Record<string, string>): string {
  const query = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return `${authUrl}${authUrl.includes('?') ? '&' : '?'}${query}`;
}

function resolveNetworkPassphrase(context: CheckContext): string {
  return (
    context.endpoints.networkPassphrase ||
    (context.isTestnet ? STELLAR_NETWORKS.TESTNET : STELLAR_NETWORKS.PUBLIC)
  );
}

interface ChallengeResponse {
  response: SafeFetchResult;
  json?: any;
  transaction?: Transaction | null;
}

async function requestChallenge(context: CheckContext, url: string): Promise<ChallengeResponse> {
  const response = await safeFetch(url, { method: 'GET' }, context.timeoutMs, context.fetchFn);
  if (!response.ok) {
    return { response };
  }

  let json: any;
  try {
    json = JSON.parse(response.data);
  } catch {
    return { response };
  }

  if (!json || typeof json.transaction !== 'string' || json.transaction.length === 0) {
    return { response, json };
  }

  return {
    response,
    json,
    transaction: parseChallengeTransaction(json.transaction, resolveNetworkPassphrase(context)),
  };
}

function readManageDataValue(op: any): string {
  if (!op || op.value === null || op.value === undefined) return '';
  if (Buffer.isBuffer(op.value)) return op.value.toString('utf8');
  try {
    return Buffer.from(op.value).toString('utf8');
  } catch {
    return String(op.value);
  }
}

function extractServerError(response: SafeFetchResult): string {
  try {
    const parsed = JSON.parse(response.data);
    if (parsed && typeof parsed.error === 'string') return `: ${parsed.error}`;
  } catch {
    // Not JSON; nothing to add.
  }
  return '';
}

/**
 * Requests a challenge that includes `client_domain` and reports on the
 * returned Manage Data operation.
 *
 * What this verifies (structure only, no signing keys involved):
 * - The server answers a challenge request that carries `client_domain`.
 * - The challenge contains a Manage Data operation named `client_domain`.
 * - That operation's value matches the requested client domain.
 * - That operation declares its own source account instead of falling back to
 *   the server account.
 *
 * What this cannot verify:
 * - That the source account is the SIGNING_KEY of the requested client domain,
 *   because the probe domain publishes no stellar.toml.
 * - That the client domain signed the challenge, because the tool has no
 *   client-domain private key. No signature is added or submitted.
 * - That the server accepts a real wallet domain it has whitelisted, or that
 *   the `client_domain` JWT claim is returned by the token endpoint, since no
 *   challenge is ever submitted.
 */
function buildClientDomainFindings(
  authUrl: string,
  probe: ChallengeResponse
): DiagnosticFinding[] {
  const findings: DiagnosticFinding[] = [];
  const clientDomainUrl = buildChallengeUrl(authUrl, {
    account: TEST_CLIENT_ACCOUNT,
    [CLIENT_DOMAIN_PARAM]: TEST_CLIENT_DOMAIN,
  });
  const specUrl = `${SEP10_SPEC_URL}#verifying-the-client-domain`;

  if (!probe.response.ok) {
    // A 400 is the response SEP-10 prescribes when the server tries to fetch the
    // probe domain's stellar.toml and finds no SIGNING_KEY, so it is expected
    // behavior rather than a defect in the anchor.
    const expectedProbeRejection = probe.response.status === 400;

    findings.push({
      id: 'sep10-client-domain-rejected',
      category: 'SEP-0010',
      severity: expectedProbeRejection ? 'info' : 'warn',
      title: expectedProbeRejection
        ? 'Client Domain Challenge Inconclusive'
        : 'Client Domain Challenge Request Failed',
      message:
        `GET ${clientDomainUrl} returned HTTP ${probe.response.status} ` +
        `${probe.response.statusText || probe.response.error || ''}${extractServerError(probe.response)}. ` +
        `SEP-10 allows servers to ignore unsupported client domains, and a server that tries to fetch ` +
        `https://${TEST_CLIENT_DOMAIN}/.well-known/stellar.toml should return HTTP 400 because the ` +
        `probe domain publishes no SIGNING_KEY. Client-domain structure could not be checked.`,
      specUrl,
      remediation:
        'No conclusion about client-domain support can be drawn from this response alone. Confirm support with a real wallet domain that publishes a stellar.toml SIGNING_KEY.',
    });
    return findings;
  }

  if (!probe.transaction) {
    findings.push({
      id: 'sep10-client-domain-invalid-challenge',
      category: 'SEP-0010',
      severity: 'warn',
      title: 'Client Domain Challenge Not Decodable',
      message:
        `GET ${clientDomainUrl} succeeded but did not return a decodable challenge transaction. ` +
        `A server that does not support client-domain verification should ignore the parameter and ` +
        `return a normal challenge, so the client_domain handling could not be verified.`,
      specUrl,
      remediation:
        'Compare the response with the same request without `client_domain`; ensure the parameter does not break challenge generation.',
    });
    return findings;
  }

  const manageDataOps = (probe.transaction.operations || []).filter(
    (op: any) => op.type === 'manageData'
  );
  const clientDomainOps = manageDataOps.filter(
    (op: any) => op.name === CLIENT_DOMAIN_MANAGE_DATA_KEY
  );

  if (clientDomainOps.length === 0) {
    findings.push({
      id: 'sep10-client-domain-missing',
      category: 'SEP-0010',
      severity: 'warn',
      title: 'Client Domain Manage Data Operation Missing',
      message:
        `Requested a challenge with ${CLIENT_DOMAIN_PARAM}=${TEST_CLIENT_DOMAIN}, but the returned ` +
        `transaction has no Manage Data operation named "${CLIENT_DOMAIN_MANAGE_DATA_KEY}". ` +
        `SEP-10 permits a server to ignore the parameter when it does not support client-domain ` +
        `verification or does not support this domain, so this may mean the feature is unsupported ` +
        `rather than broken.`,
      specUrl,
      remediation:
        'If wallet attribution via client domain is required, implement the optional client_domain Manage Data operation and confirm with a real wallet domain.',
    });
  } else {
    const op = clientDomainOps[0];
    const actualValue = readManageDataValue(op);

    if (actualValue !== TEST_CLIENT_DOMAIN) {
      findings.push({
        id: 'sep10-client-domain-value-mismatch',
        category: 'SEP-0010',
        severity: 'error',
        title: 'Client Domain Operation Value Mismatch',
        message:
          `The "${CLIENT_DOMAIN_MANAGE_DATA_KEY}" Manage Data operation value is ` +
          `"${actualValue || '(empty)'}", expected "${TEST_CLIENT_DOMAIN}" from the request.`,
        specUrl,
        remediation: `Set the \`${CLIENT_DOMAIN_MANAGE_DATA_KEY}\` Manage Data value to the exact ${CLIENT_DOMAIN_PARAM} value received in the challenge request.`,
      });
    }

    const sourceIssues: string[] = [];
    if (!op.source) {
      sourceIssues.push(
        'it declares no source account, so it inherits the server account as source'
      );
    } else if (op.source === TEST_CLIENT_ACCOUNT) {
      sourceIssues.push('its source account is the client account, not the client domain account');
    }

    if (sourceIssues.length > 0) {
      findings.push({
        id: 'sep10-client-domain-source',
        category: 'SEP-0010',
        severity: 'error',
        title: 'Client Domain Operation Source Account Invalid',
        message: `The "${CLIENT_DOMAIN_MANAGE_DATA_KEY}" Manage Data operation cannot be attributed to a client domain because ${sourceIssues.join(' and ')}.`,
        specUrl,
        remediation:
          'Set the operation source to the SIGNING_KEY published in the client domain stellar.toml so the client domain can sign the challenge.',
      });
    }

    if (actualValue === TEST_CLIENT_DOMAIN && sourceIssues.length === 0) {
      findings.push({
        id: 'sep10-client-domain-valid',
        category: 'SEP-0010',
        severity: 'pass',
        title: 'Client Domain Manage Data Operation Present',
        message:
          `Challenge requested with ${CLIENT_DOMAIN_PARAM}=${TEST_CLIENT_DOMAIN} contains a ` +
          `"${CLIENT_DOMAIN_MANAGE_DATA_KEY}" Manage Data operation with the expected value and a ` +
          `dedicated source account (${op.source}).`,
        specUrl,
      });
    }
  }

  return findings;
}

export const sep10Check: DiagnosticCheck = {
  id: 'sep-10',
  name: 'SEP-0010: Stellar Web Authentication',
  category: 'SEP-0010',
  description:
    'Validates AUTH_SERVER endpoint, CORS, challenge transaction sequence, timebounds, signatures, and client_domain challenge structure',
  specUrl: SEP10_SPEC_URL,

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
        specUrl: SEP10_SPEC_URL,
      });
      return findings;
    }

    // 1. Request challenge transaction
    const challengeUrl = buildChallengeUrl(authUrl, { account: TEST_CLIENT_ACCOUNT });
    const challenge = await requestChallenge(context, challengeUrl);
    const res = challenge.response;

    if (!res.ok) {
      findings.push({
        id: 'sep10-endpoint-fail',
        category: 'SEP-0010',
        severity: 'error',
        title: 'AUTH_SERVER Failed Challenge Request',
        message: `GET ${challengeUrl} failed with HTTP ${res.status} ${res.statusText || res.error || ''}`,
        specUrl: SEP10_SPEC_URL,
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
        specUrl: `${SEP10_SPEC_URL}#cors`,
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
    if (!challenge.json) {
      findings.push({
        id: 'sep10-response-json',
        category: 'SEP-0010',
        severity: 'error',
        title: 'Invalid JSON Response',
        message: 'AUTH_SERVER did not return valid JSON.',
        specUrl: SEP10_SPEC_URL,
      });
      return findings;
    }

    if (!challenge.json.transaction) {
      findings.push({
        id: 'sep10-transaction-field',
        category: 'SEP-0010',
        severity: 'error',
        title: 'Missing "transaction" Field',
        message: 'AUTH_SERVER response JSON must contain a "transaction" key with the base64 challenge XDR.',
        specUrl: SEP10_SPEC_URL,
      });
      return findings;
    }

    // 4. Validate Challenge Transaction XDR
    const networkPassphrase = resolveNetworkPassphrase(context);
    const tx = challenge.transaction;

    if (!tx) {
      findings.push({
        id: 'sep10-xdr-parse',
        category: 'SEP-0010',
        severity: 'error',
        title: 'Invalid Challenge Transaction XDR',
        message: 'Unable to decode base64 challenge transaction or network passphrase mismatch.',
        specUrl: SEP10_SPEC_URL,
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
        specUrl: `${SEP10_SPEC_URL}#challenge`,
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
        specUrl: `${SEP10_SPEC_URL}#challenge`,
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
          specUrl: SEP10_SPEC_URL,
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
        specUrl: `${SEP10_SPEC_URL}#challenge`,
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
        specUrl: `${SEP10_SPEC_URL}#challenge`,
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

    // 9. Client Domain Check (structural only)
    // A challenge returned without a client_domain request must not contain the
    // optional client_domain operation: the client cannot be expected to sign
    // for a domain it never asked the server to verify.
    const unexpectedClientDomainOp = manageDataOps.find(
      (op: any) => op.name === CLIENT_DOMAIN_MANAGE_DATA_KEY
    );
    if (unexpectedClientDomainOp) {
      findings.push({
        id: 'sep10-client-domain-unexpected',
        category: 'SEP-0010',
        severity: 'warn',
        title: 'Unexpected Client Domain Operation',
        message:
          `The challenge returned for a request without ${CLIENT_DOMAIN_PARAM} contains a ` +
          `"${CLIENT_DOMAIN_MANAGE_DATA_KEY}" Manage Data operation, so it was injected without being requested.`,
        specUrl: `${SEP10_SPEC_URL}#verifying-the-client-domain`,
        remediation:
          'Only add the client_domain Manage Data operation when the challenge request includes a client_domain parameter.',
      });
    }

    const clientDomainProbe = await requestChallenge(
      context,
      buildChallengeUrl(authUrl, {
        account: TEST_CLIENT_ACCOUNT,
        [CLIENT_DOMAIN_PARAM]: TEST_CLIENT_DOMAIN,
      })
    );
    findings.push(...buildClientDomainFindings(authUrl, clientDomainProbe));

    findings.push({
      id: 'sep10-client-domain-limits',
      category: 'SEP-0010',
      severity: 'info',
      title: 'Client Domain Validation Is Structural Only',
      message:
        `Checked the presence, value ("${TEST_CLIENT_DOMAIN}") and source account of the ` +
        `"${CLIENT_DOMAIN_MANAGE_DATA_KEY}" Manage Data operation only. No client-domain signing key ` +
        `was available, so the client domain did not sign the challenge and no signature was verified; ` +
        `the probe domain's stellar.toml SIGNING_KEY was not fetched and no transaction was submitted.`,
      specUrl: `${SEP10_SPEC_URL}#verifying-the-client-domain`,
    });

    return findings;
  },
};

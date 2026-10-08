import { CheckContext, DiagnosticCheck, DiagnosticFinding } from '../types.js';
import { safeFetch } from '../utils/http.js';

export const sep24Check: DiagnosticCheck = {
  id: 'sep-24',
  name: 'SEP-0024: Hosted Deposit and Withdrawal',
  category: 'SEP-0024',
  description: 'Validates TRANSFER_SERVER_SEP0024 /info endpoint, CORS, deposit/withdrawal asset schema, and fee config',
  specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0024.md',

  async run(context: CheckContext): Promise<DiagnosticFinding[]> {
    const findings: DiagnosticFinding[] = [];
    const serverUrl = context.endpoints.transferServerSep24Url;

    if (!serverUrl) {
      findings.push({
        id: 'sep24-not-configured',
        category: 'SEP-0024',
        severity: 'info',
        title: 'TRANSFER_SERVER_SEP0024 Not Configured',
        message: 'No TRANSFER_SERVER_SEP0024 declared in stellar.toml; skipping SEP-24 diagnostics.',
        specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0024.md',
      });
      return findings;
    }

    const infoUrl = `${serverUrl.replace(/\/$/, '')}/info`;
    const res = await safeFetch(infoUrl, { method: 'GET' }, context.timeoutMs, context.fetchFn);

    if (!res.ok) {
      findings.push({
        id: 'sep24-info-fail',
        category: 'SEP-0024',
        severity: 'error',
        title: 'SEP-24 /info Endpoint Failed',
        message: `GET ${infoUrl} returned HTTP ${res.status} ${res.statusText || res.error || ''}`,
        specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0024.md#info',
        remediation: 'Ensure the SEP-24 transfer server hosts an accessible /info endpoint over HTTPS.',
      });
      return findings;
    }

    findings.push({
      id: 'sep24-info-online',
      category: 'SEP-0024',
      severity: 'pass',
      title: 'SEP-24 /info Endpoint Accessible',
      message: `Successfully connected to ${infoUrl} (${res.durationMs}ms)`,
    });

    // CORS check
    const acao = res.headers.get('access-control-allow-origin');
    if (!acao || acao !== '*') {
      findings.push({
        id: 'sep24-cors',
        category: 'SEP-0024',
        severity: 'warn',
        title: 'SEP-24 Missing Wildcard CORS',
        message: `Access-Control-Allow-Origin: '${acao || 'none'}', expected '*' for interactive wallet sessions.`,
        specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0024.md#cors',
        remediation: 'Set `Access-Control-Allow-Origin: *` on SEP-24 endpoints.',
      });
    } else {
      findings.push({
        id: 'sep24-cors',
        category: 'SEP-0024',
        severity: 'pass',
        title: 'SEP-24 CORS Allowed',
        message: 'Access-Control-Allow-Origin is set to *',
      });
    }

    // JSON Parse
    let json: any;
    try {
      json = JSON.parse(res.data);
    } catch {
      findings.push({
        id: 'sep24-json-invalid',
        category: 'SEP-0024',
        severity: 'error',
        title: 'SEP-24 /info Invalid JSON',
        message: '/info endpoint did not return valid JSON.',
      });
      return findings;
    }

    // Schema Validation: deposit map
    if (!json.deposit || typeof json.deposit !== 'object') {
      findings.push({
        id: 'sep24-deposit-missing',
        category: 'SEP-0024',
        severity: 'error',
        title: 'Missing "deposit" Object in /info',
        message: 'The /info response must contain a "deposit" mapping of supported assets.',
        specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0024.md#info',
      });
    } else {
      const depositAssets = Object.keys(json.deposit);
      findings.push({
        id: 'sep24-deposit-valid',
        category: 'SEP-0024',
        severity: 'pass',
        title: 'Deposit Assets Configured',
        message: `Found ${depositAssets.length} deposit asset(s): ${depositAssets.join(', ') || 'none'}`,
      });
    }

    // Schema Validation: withdraw map
    if (!json.withdraw || typeof json.withdraw !== 'object') {
      findings.push({
        id: 'sep24-withdraw-missing',
        category: 'SEP-0024',
        severity: 'error',
        title: 'Missing "withdraw" Object in /info',
        message: 'The /info response must contain a "withdraw" mapping of supported assets.',
        specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0024.md#info',
      });
    } else {
      const withdrawAssets = Object.keys(json.withdraw);
      findings.push({
        id: 'sep24-withdraw-valid',
        category: 'SEP-0024',
        severity: 'pass',
        title: 'Withdrawal Assets Configured',
        message: `Found ${withdrawAssets.length} withdrawal asset(s): ${withdrawAssets.join(', ') || 'none'}`,
      });
    }

    // Fee structure check
    if (json.fee && typeof json.fee.enabled === 'boolean') {
      findings.push({
        id: 'sep24-fee-config',
        category: 'SEP-0024',
        severity: 'pass',
        title: 'Fee Endpoint Configuration Declared',
        message: `Fee endpoint enabled: ${json.fee.enabled}`,
      });
    }

    return findings;
  },
};

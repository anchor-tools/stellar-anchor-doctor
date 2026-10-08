import { CheckContext, DiagnosticCheck, DiagnosticFinding } from '../types.js';
import { safeFetch } from '../utils/http.js';

export const sep6Check: DiagnosticCheck = {
  id: 'sep-6',
  name: 'SEP-0006: Programmatic Deposit and Withdrawal',
  category: 'SEP-0006',
  description: 'Validates TRANSFER_SERVER /info endpoint, CORS, deposit/withdrawal asset schema for SEP-6',
  specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0006.md',

  async run(context: CheckContext): Promise<DiagnosticFinding[]> {
    const findings: DiagnosticFinding[] = [];
    const serverUrl = context.endpoints.transferServerSep6Url;

    if (!serverUrl) {
      findings.push({
        id: 'sep6-not-configured',
        category: 'SEP-0006',
        severity: 'info',
        title: 'TRANSFER_SERVER Not Configured',
        message: 'No TRANSFER_SERVER declared in stellar.toml; skipping SEP-6 diagnostics.',
        specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0006.md',
      });
      return findings;
    }

    const infoUrl = `${serverUrl.replace(/\/$/, '')}/info`;
    const res = await safeFetch(infoUrl, { method: 'GET' }, context.timeoutMs, context.fetchFn);

    if (!res.ok) {
      findings.push({
        id: 'sep6-info-fail',
        category: 'SEP-0006',
        severity: 'error',
        title: 'SEP-6 /info Endpoint Failed',
        message: `GET ${infoUrl} returned HTTP ${res.status} ${res.statusText || res.error || ''}`,
        specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0006.md#info',
        remediation: 'Ensure the SEP-6 transfer server hosts an accessible /info endpoint over HTTPS.',
      });
      return findings;
    }

    findings.push({
      id: 'sep6-info-online',
      category: 'SEP-0006',
      severity: 'pass',
      title: 'SEP-6 /info Endpoint Accessible',
      message: `Successfully connected to ${infoUrl} (${res.durationMs}ms)`,
    });

    // CORS check
    const acao = res.headers.get('access-control-allow-origin');
    if (!acao || acao !== '*') {
      findings.push({
        id: 'sep6-cors',
        category: 'SEP-0006',
        severity: 'warn',
        title: 'SEP-6 Missing Wildcard CORS',
        message: `Access-Control-Allow-Origin: '${acao || 'none'}', expected '*' for programmatic wallets.`,
        specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0006.md#cors',
        remediation: 'Set `Access-Control-Allow-Origin: *` on SEP-6 transfer server endpoints.',
      });
    } else {
      findings.push({
        id: 'sep6-cors',
        category: 'SEP-0006',
        severity: 'pass',
        title: 'SEP-6 CORS Allowed',
        message: 'Access-Control-Allow-Origin is set to *',
      });
    }

    // JSON Parse
    let json: any;
    try {
      json = JSON.parse(res.data);
    } catch {
      findings.push({
        id: 'sep6-json-invalid',
        category: 'SEP-0006',
        severity: 'error',
        title: 'SEP-6 /info Invalid JSON',
        message: '/info endpoint did not return valid JSON.',
      });
      return findings;
    }

    if (json.deposit && typeof json.deposit === 'object') {
      const depositAssets = Object.keys(json.deposit);
      findings.push({
        id: 'sep6-deposit-valid',
        category: 'SEP-0006',
        severity: 'pass',
        title: 'SEP-6 Deposit Assets Configured',
        message: `Found ${depositAssets.length} deposit asset(s): ${depositAssets.join(', ') || 'none'}`,
      });
    }

    if (json.withdraw && typeof json.withdraw === 'object') {
      const withdrawAssets = Object.keys(json.withdraw);
      findings.push({
        id: 'sep6-withdraw-valid',
        category: 'SEP-0006',
        severity: 'pass',
        title: 'SEP-6 Withdrawal Assets Configured',
        message: `Found ${withdrawAssets.length} withdrawal asset(s): ${withdrawAssets.join(', ') || 'none'}`,
      });
    }

    return findings;
  },
};

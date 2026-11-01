import { CheckContext, DiagnosticCheck, DiagnosticFinding } from '../types.js';
import { safeFetch } from '../utils/http.js';

export const sep31Check: DiagnosticCheck = {
  id: 'sep-31',
  name: 'SEP-0031: Cross-Border Payments (Direct Payments)',
  category: 'SEP-0031',
  description:
    'Validates DIRECT_PAYMENT_SERVER /info endpoint, wildcard CORS, and SEP-31 deposit/withdraw/fields configuration',
  specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0031.md',

  async run(context: CheckContext): Promise<DiagnosticFinding[]> {
    const findings: DiagnosticFinding[] = [];
    const serverUrl = context.endpoints.directPaymentServerUrl;

    if (!serverUrl) {
      findings.push({
        id: 'sep31-not-configured',
        category: 'SEP-0031',
        severity: 'info',
        title: 'DIRECT_PAYMENT_SERVER Not Configured',
        message:
          'No DIRECT_PAYMENT_SERVER declared in stellar.toml; skipping SEP-31 cross-border payments diagnostics.',
        specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0031.md',
      });
      return findings;
    }

    const infoUrl = `${serverUrl.replace(/\/$/, '')}/info`;
    const res = await safeFetch(infoUrl, { method: 'GET' }, context.timeoutMs, context.fetchFn);

    if (!res.ok) {
      findings.push({
        id: 'sep31-info-fail',
        category: 'SEP-0031',
        severity: 'error',
        title: 'SEP-31 /info Endpoint Failed',
        message: `GET ${infoUrl} returned HTTP ${res.status} ${res.statusText || res.error || ''}`,
        specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0031.md#get-info',
        remediation: 'Ensure the SEP-31 direct payment server hosts an accessible /info endpoint over HTTPS.',
      });
      return findings;
    }

    findings.push({
      id: 'sep31-info-online',
      category: 'SEP-0031',
      severity: 'pass',
      title: 'SEP-31 /info Endpoint Accessible',
      message: `Successfully connected to ${infoUrl} (${res.durationMs}ms)`,
    });

    // CORS check
    const acao = res.headers.get('access-control-allow-origin');
    if (!acao || acao !== '*') {
      findings.push({
        id: 'sep31-cors',
        category: 'SEP-0031',
        severity: 'warn',
        title: 'SEP-31 Missing Wildcard CORS',
        message: `Access-Control-Allow-Origin: '${acao || 'none'}', expected '*' for cross-border payment clients.`,
        specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0031.md#cors',
        remediation: 'Set `Access-Control-Allow-Origin: *` on SEP-31 direct payment server endpoints.',
      });
    } else {
      findings.push({
        id: 'sep31-cors',
        category: 'SEP-0031',
        severity: 'pass',
        title: 'SEP-31 CORS Allowed',
        message: 'Access-Control-Allow-Origin is set to *',
      });
    }

    // JSON Parse
    let json: any;
    try {
      json = JSON.parse(res.data);
    } catch {
      findings.push({
        id: 'sep31-json-invalid',
        category: 'SEP-0031',
        severity: 'error',
        title: 'SEP-31 /info Invalid JSON',
        message: '/info endpoint did not return valid JSON.',
      });
      return findings;
    }

    // Documented SEP-31 /info fields: deposit, withdraw, fields, (optional) fee
    const deposit = json.deposit;
    const withdraw = json.withdraw;
    const fields = json.fields;

    if (deposit && typeof deposit === 'object' && !Array.isArray(deposit)) {
      const depositAssets = Object.keys(deposit);
      findings.push({
        id: 'sep31-deposit-valid',
        category: 'SEP-0031',
        severity: 'pass',
        title: 'SEP-31 Deposit Assets Configured',
        message: `Found ${depositAssets.length} deposit asset(s): ${depositAssets.join(', ') || 'none'}`,
      });
    } else {
      findings.push({
        id: 'sep31-deposit-missing',
        category: 'SEP-0031',
        severity: 'warn',
        title: 'SEP-31 Deposit Map Missing',
        message: 'The /info response should declare a `deposit` map keyed by asset code.',
        specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0031.md#get-info',
        remediation: 'Add a `deposit` object to /info describing supported cross-border deposit assets.',
      });
    }

    if (withdraw && typeof withdraw === 'object' && !Array.isArray(withdraw)) {
      const withdrawAssets = Object.keys(withdraw);
      findings.push({
        id: 'sep31-withdraw-valid',
        category: 'SEP-0031',
        severity: 'pass',
        title: 'SEP-31 Withdrawal Assets Configured',
        message: `Found ${withdrawAssets.length} withdrawal asset(s): ${withdrawAssets.join(', ') || 'none'}`,
      });
    } else {
      findings.push({
        id: 'sep31-withdraw-missing',
        category: 'SEP-0031',
        severity: 'warn',
        title: 'SEP-31 Withdrawal Map Missing',
        message: 'The /info response should declare a `withdraw` map keyed by asset code.',
        specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0031.md#get-info',
        remediation: 'Add a `withdraw` object to /info describing supported cross-border withdrawal assets.',
      });
    }

    if (Array.isArray(fields) && fields.length > 0) {
      findings.push({
        id: 'sep31-fields-valid',
        category: 'SEP-0031',
        severity: 'pass',
        title: 'SEP-31 Transaction Fields Declared',
        message: `Declared ${fields.length} transaction field(s) for cross-border payment instructions.`,
      });
    } else {
      findings.push({
        id: 'sep31-fields-missing',
        category: 'SEP-0031',
        severity: 'info',
        title: 'SEP-31 Transaction Fields Not Declared',
        message: 'The /info response does not declare a `fields` array of payment instructions.',
        specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0031.md#get-info',
        remediation:
          'Declare a `fields` array describing required transaction fields for cross-border payments (e.g. origin, destination, and payment details).',
      });
    }

    if (json.fee && typeof json.fee === 'object' && !Array.isArray(json.fee)) {
      findings.push({
        id: 'sep31-fee-valid',
        category: 'SEP-0031',
        severity: 'pass',
        title: 'SEP-31 Fee Configuration Declared',
        message: 'Fee configuration is present in /info response.',
      });
    }

    return findings;
  },
};

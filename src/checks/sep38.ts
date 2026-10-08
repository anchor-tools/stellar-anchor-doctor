import { CheckContext, DiagnosticCheck, DiagnosticFinding } from '../types.js';
import { safeFetch } from '../utils/http.js';

export const sep38Check: DiagnosticCheck = {
  id: 'sep-38',
  name: 'SEP-0038: Anchor RFQ / Quotes API',
  category: 'SEP-0038',
  description: 'Validates ANCHOR_QUOTE_SERVER /info endpoint, CORS, and supported quote assets schema',
  specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0038.md',

  async run(context: CheckContext): Promise<DiagnosticFinding[]> {
    const findings: DiagnosticFinding[] = [];
    const serverUrl = context.endpoints.anchorQuoteServerUrl;

    if (!serverUrl) {
      findings.push({
        id: 'sep38-not-configured',
        category: 'SEP-0038',
        severity: 'info',
        title: 'ANCHOR_QUOTE_SERVER Not Configured',
        message: 'No ANCHOR_QUOTE_SERVER declared in stellar.toml; skipping SEP-38 diagnostics.',
        specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0038.md',
      });
      return findings;
    }

    const infoUrl = `${serverUrl.replace(/\/$/, '')}/info`;
    const res = await safeFetch(infoUrl, { method: 'GET' }, context.timeoutMs, context.fetchFn);

    if (!res.ok) {
      findings.push({
        id: 'sep38-info-fail',
        category: 'SEP-0038',
        severity: 'error',
        title: 'SEP-38 /info Endpoint Failed',
        message: `GET ${infoUrl} returned HTTP ${res.status} ${res.statusText || res.error || ''}`,
        specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0038.md#get-info',
        remediation: 'Ensure the SEP-38 quote server hosts an accessible /info endpoint over HTTPS.',
      });
      return findings;
    }

    findings.push({
      id: 'sep38-info-online',
      category: 'SEP-0038',
      severity: 'pass',
      title: 'SEP-38 /info Endpoint Accessible',
      message: `Successfully connected to ${infoUrl} (${res.durationMs}ms)`,
    });

    // CORS check
    const acao = res.headers.get('access-control-allow-origin');
    if (!acao || acao !== '*') {
      findings.push({
        id: 'sep38-cors',
        category: 'SEP-0038',
        severity: 'warn',
        title: 'SEP-38 Missing Wildcard CORS',
        message: `Access-Control-Allow-Origin: '${acao || 'none'}', expected '*' for client quotes.`,
        specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0038.md#cors',
        remediation: 'Set `Access-Control-Allow-Origin: *` on SEP-38 quote server endpoints.',
      });
    } else {
      findings.push({
        id: 'sep38-cors',
        category: 'SEP-0038',
        severity: 'pass',
        title: 'SEP-38 CORS Allowed',
        message: 'Access-Control-Allow-Origin is set to *',
      });
    }

    // JSON Parse
    let json: any;
    try {
      json = JSON.parse(res.data);
    } catch {
      findings.push({
        id: 'sep38-json-invalid',
        category: 'SEP-0038',
        severity: 'error',
        title: 'SEP-38 /info Invalid JSON',
        message: '/info endpoint did not return valid JSON.',
      });
      return findings;
    }

    // Schema Validation: assets array
    if (!Array.isArray(json.assets)) {
      findings.push({
        id: 'sep38-assets-missing',
        category: 'SEP-0038',
        severity: 'error',
        title: 'Missing "assets" Array in /info',
        message: 'The /info response must contain an "assets" array.',
        specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0038.md#get-info',
      });
    } else {
      const assetCount = json.assets.length;
      let validAssetCount = 0;

      for (const assetObj of json.assets) {
        if (assetObj.asset && typeof assetObj.asset === 'string') {
          // Check asset identification format (sep38:stellar:... or iso4217:...)
          if (
            assetObj.asset.startsWith('stellar:') ||
            assetObj.asset.startsWith('iso4217:')
          ) {
            validAssetCount++;
          }
        }
      }

      findings.push({
        id: 'sep38-assets-valid',
        category: 'SEP-0038',
        severity: 'pass',
        title: 'Quote Assets Configured',
        message: `Configured ${assetCount} asset(s) for RFQ quotes (${validAssetCount} formatted per SEP-38 identification standard)`,
      });
    }

    return findings;
  },
};

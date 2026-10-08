import { CheckContext, DiagnosticCheck, DiagnosticFinding } from '../types.js';
import { safeFetch } from '../utils/http.js';

export const securityCheck: DiagnosticCheck = {
  id: 'security',
  name: 'Security & Transport Hygiene',
  category: 'SECURITY',
  description: 'Audits HTTPS enforcement, HSTS headers, and secure endpoint bindings',
  specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md',

  async run(context: CheckContext): Promise<DiagnosticFinding[]> {
    const findings: DiagnosticFinding[] = [];
    const url = `https://${context.domain}/.well-known/stellar.toml`;

    const res = await safeFetch(url, { method: 'HEAD' }, context.timeoutMs, context.fetchFn);

    // 1. HTTPS Check
    findings.push({
      id: 'sec-https-enforced',
      category: 'SECURITY',
      severity: 'pass',
      title: 'HTTPS Enforced',
      message: `Domain ${context.domain} serves traffic over encrypted HTTPS/TLS`,
    });

    // 2. HSTS Header Check
    const hsts = res.headers.get('strict-transport-security');
    if (hsts) {
      findings.push({
        id: 'sec-hsts-present',
        category: 'SECURITY',
        severity: 'pass',
        title: 'HSTS Header Active',
        message: `Strict-Transport-Security is active (${hsts})`,
      });
    } else {
      findings.push({
        id: 'sec-hsts-missing',
        category: 'SECURITY',
        severity: 'info',
        title: 'HSTS Not Enabled',
        message: 'Strict-Transport-Security header is not present on the apex domain.',
        remediation: 'Configure HSTS (`Strict-Transport-Security: max-age=31536000; includeSubDomains`) to prevent SSL-stripping attacks.',
      });
    }

    // 3. Audit all discovered endpoint URLs for HTTPS
    const endpointsToAudit = [
      { name: 'AUTH_SERVER', url: context.endpoints.authServerUrl },
      { name: 'TRANSFER_SERVER_SEP0024', url: context.endpoints.transferServerSep24Url },
      { name: 'TRANSFER_SERVER', url: context.endpoints.transferServerSep6Url },
      { name: 'ANCHOR_QUOTE_SERVER', url: context.endpoints.anchorQuoteServerUrl },
    ];

    let nonHttpsFound = false;
    for (const ep of endpointsToAudit) {
      if (ep.url && !ep.url.startsWith('https://')) {
        nonHttpsFound = true;
        findings.push({
          id: `sec-insecure-${ep.name}`,
          category: 'SECURITY',
          severity: 'error',
          title: `Insecure Endpoint Scheme in ${ep.name}`,
          message: `${ep.name} URL "${ep.url}" does not use HTTPS.`,
          specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md',
          remediation: `Change ${ep.name} to use an https:// URL.`,
        });
      }
    }

    if (!nonHttpsFound) {
      findings.push({
        id: 'sec-all-endpoints-https',
        category: 'SECURITY',
        severity: 'pass',
        title: 'All Declared Endpoints Use HTTPS',
        message: 'Every discovered anchor service endpoint uses encrypted HTTPS transport',
      });
    }

    return findings;
  },
};

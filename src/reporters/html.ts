import { AnchorReport, CheckCategory, DiagnosticFinding, Grade } from '../types.js';

/**
 * Escape a string for safe inclusion in HTML text or attribute context.
 * All report-derived data (domains, messages, remediation hints, URLs) is run
 * through this before being interpolated into the document.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CATEGORIES: CheckCategory[] = [
  'SEP-0001',
  'SEP-0010',
  'SEP-0024',
  'SEP-0031',
  'SEP-0038',
  'SEP-0006',
  'SECURITY',
  'NETWORK',
];

interface SeverityMeta {
  label: string;
  icon: string;
}

const SEVERITY_META: Record<DiagnosticFinding['severity'], SeverityMeta> = {
  pass: { label: 'PASS', icon: '✔' },
  info: { label: 'INFO', icon: 'ℹ' },
  warn: { label: 'WARNING', icon: '⚠' },
  error: { label: 'ERROR', icon: '✖' },
};

function gradeTone(grade: Grade): string {
  switch (grade) {
    case 'A+':
    case 'A':
      return 'green';
    case 'B':
      return 'teal';
    case 'C':
      return 'amber';
    default:
      return 'red';
  }
}

function renderEndpoints(report: AnchorReport): string {
  const rows: string[] = [];
  const addRow = (label: string, url: string) => {
    rows.push(
      `<li class="endpoint"><span class="endpoint-name">${escapeHtml(label)}</span><code>${escapeHtml(url)}</code></li>`
    );
  };

  if (report.endpoints.stellarTomlUrl) addRow('SEP-1 stellar.toml', report.endpoints.stellarTomlUrl);
  if (report.endpoints.authServerUrl) addRow('SEP-10 Auth Server', report.endpoints.authServerUrl);
  if (report.endpoints.transferServerSep24Url) {
    addRow('SEP-24 Transfer Server', report.endpoints.transferServerSep24Url);
  }
  if (report.endpoints.transferServerSep6Url) {
    addRow('SEP-6 Transfer Server', report.endpoints.transferServerSep6Url);
  }
  if (report.endpoints.anchorQuoteServerUrl) {
    addRow('SEP-38 Quote Server', report.endpoints.anchorQuoteServerUrl);
  }

  if (rows.length === 0) return '';
  return `
        <section class="endpoints" aria-label="Discovered endpoints">
          <h2>Discovered Endpoints</h2>
          <ul>${rows.join('\n')}</ul>
        </section>`;
}

function renderFinding(f: DiagnosticFinding): string {
  const meta = SEVERITY_META[f.severity];
  const specLink = f.specUrl
    ? ` <a class="spec-link" href="${escapeHtml(f.specUrl)}" rel="noopener noreferrer" target="_blank">Specification</a>`
    : '';
  const remediation = f.remediation
    ? `<p class="remediation"><span class="remediation-label">Remediation:</span> ${escapeHtml(f.remediation)}</p>`
    : '';

  return `
        <li class="finding severity-${f.severity}">
          <div class="finding-head">
            <span class="badge badge-${f.severity}" role="status">${meta.icon} ${escapeHtml(meta.label)}</span>
            <h3>${escapeHtml(f.title)}</h3>
          </div>
          <p class="finding-message">${escapeHtml(f.message)}</p>
          ${remediation}
          <p class="finding-links">${specLink}</p>
        </li>`;
}

function renderFindings(report: AnchorReport): string {
  const grouped = new Map<CheckCategory, DiagnosticFinding[]>();
  for (const f of report.findings) {
    const list = grouped.get(f.category) || [];
    list.push(f);
    grouped.set(f.category, list);
  }

  const sections: string[] = [];
  for (const category of CATEGORIES) {
    const findings = grouped.get(category);
    if (!findings || findings.length === 0) continue;
    sections.push(`
          <section class="category" aria-label="${escapeHtml(category)}">
            <h2>${escapeHtml(category)}</h2>
            <ul class="findings-list">${findings.map(renderFinding).join('\n')}
            </ul>
          </section>`);
  }

  if (sections.length === 0) {
    return '';
  }

  return `
        <section class="findings" aria-label="Diagnostic findings">
          <h2 class="findings-title">Diagnostic Findings</h2>
          ${sections.join('\n')}
        </section>`;
}

const STYLES = `
  :root {
    --bg: #f6f7f9;
    --card-bg: #ffffff;
    --text: #1f2430;
    --text-muted: #5b6472;
    --border: #dfe3e9;
    --accent: #08b5e5;
    --green: #1a7f37;
    --green-bg: #dafbe1;
    --teal: #0c7b8f;
    --teal-bg: #d9f1f5;
    --amber: #9a6700;
    --amber-bg: #fff8c5;
    --red: #cf222e;
    --red-bg: #ffebe9;
    --info: #0969da;
    --info-bg: #ddf4ff;
    --focus-ring: #08b5e5;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0d1117;
      --card-bg: #161b22;
      --text: #e6edf3;
      --text-muted: #8b949e;
      --border: #30363d;
      --green: #3fb950;
      --green-bg: #12261d;
      --teal: #56d4dd;
      --teal-bg: #0d2a33;
      --amber: #d29922;
      --amber-bg: #2d2410;
      --red: #f85149;
      --red-bg: #3d1420;
      --info: #58a6ff;
      --info-bg: #0f2b45;
      --focus-ring: #58a6ff;
    }
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    padding: 2rem 1rem;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.55;
  }

  .report {
    max-width: 860px;
    margin: 0 auto;
  }

  @media (max-width: 600px) {
    body { padding: 1.5rem 0.75rem; }
    .report { max-width: 100%; }
  }

  h1, h2, h3 { margin: 0; line-height: 1.25; }

  h1 { font-size: 1.6rem; }
  h2 { font-size: 1.15rem; margin-bottom: 0.75rem; }
  h3 { font-size: 1rem; }

  a { color: var(--info); }

  .report-header {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1.5rem 1.75rem;
    margin-bottom: 1.25rem;
  }

  .report-header h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
  .audit-domain { margin: 0.25rem 0 0; font-size: 1.1rem; }
  .meta { margin: 0.5rem 0 0; color: var(--text-muted); font-size: 0.875rem; }

  .score-card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1.5rem 1.75rem;
    margin-bottom: 1.25rem;
  }

  .score-row {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 0.75rem;
  }

  .score-value { font-size: 2.75rem; font-weight: 700; letter-spacing: -0.02em; }
  .score-max { color: var(--text-muted); font-size: 1.1rem; }
  .score-grade {
    margin-left: auto;
    font-size: 1.25rem;
    font-weight: 700;
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
    border: 1px solid var(--border);
  }

  .grade-green { color: var(--green); background: var(--green-bg); }
  .grade-teal { color: var(--teal); background: var(--teal-bg); }
  .grade-amber { color: var(--amber); background: var(--amber-bg); }
  .grade-red { color: var(--red); background: var(--red-bg); }

  .score-bar {
    display: block;
    width: 100%;
    height: 12px;
    border: 0;
    border-radius: 6px;
    overflow: hidden;
    background: var(--border);
    appearance: none;
  }

  .score-bar::-webkit-progress-bar { background: var(--border); }
  .score-bar::-webkit-progress-value { background: var(--accent); border-radius: 6px; }
  .score-bar::-moz-progress-bar { background: var(--accent); border-radius: 6px; }

  .summary-strip {
    list-style: none;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 0.75rem;
    margin: 1rem 0 0;
    padding: 0;
  }

  @media (max-width: 480px) {
    .summary-strip { grid-template-columns: 1fr 1fr; }
  }

  .stat {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 0.875rem;
  }

  .stat-icon { font-size: 1.1rem; }
  .stat-count { font-weight: 700; margin-left: auto; }

  .stat-pass, .badge-pass { color: var(--green); background: var(--green-bg); }
  .stat-info, .badge-info { color: var(--info); background: var(--info-bg); }
  .stat-warn, .badge-warn { color: var(--amber); background: var(--amber-bg); }
  .stat-error, .badge-error { color: var(--red); background: var(--red-bg); }

  section.endpoints, .category {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1.25rem 1.5rem;
    margin-bottom: 1.25rem;
  }

  .endpoints ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }

  .endpoint {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    flex-wrap: wrap;
    font-size: 0.95rem;
  }

  .endpoint-name { font-weight: 600; min-width: 10rem; }

  .endpoint code {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.15rem 0.45rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.85rem;
    word-break: break-all;
  }

  .findings-title { margin-bottom: 0.25rem; }
  .category h2 {
    color: var(--text-muted);
    font-size: 0.95rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .findings-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.9rem;
  }

  .finding {
    border: 1px solid var(--border);
    border-left-width: 4px;
    border-radius: 8px;
    padding: 0.9rem 1.1rem;
  }

  .finding.severity-pass { border-left-color: var(--green); }
  .finding.severity-info { border-left-color: var(--info); }
  .finding.severity-warn { border-left-color: var(--amber); }
  .finding.severity-error { border-left-color: var(--red); }

  .finding-head {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
    margin-bottom: 0.35rem;
  }

  .badge {
    display: inline-block;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
  }

  .finding-message { margin: 0 0 0.4rem; color: var(--text); }

  .remediation { margin: 0 0 0.3rem; font-size: 0.95rem; }
  .remediation-label { font-weight: 600; }

  .finding-links { margin: 0; font-size: 0.9rem; }

  .report-footer {
    text-align: center;
    color: var(--text-muted);
    font-size: 0.8125rem;
    margin-top: 1.5rem;
  }

  @media (prefers-reduced-motion: no-preference) {
    .finding, .score-card, .report-header, section.endpoints, .category {
      transition: border-color 120ms ease;
    }
  }
`;

export function formatHtmlReport(report: AnchorReport): string {
  const summary = report.summary;
  const tone = gradeTone(report.grade);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="generator" content="stellar-anchor-doctor">
    <title>Stellar Anchor Doctor — Audit Report for ${escapeHtml(report.domain)}</title>
    <style>${STYLES}</style>
  </head>
  <body>
    <main class="report">
      <header class="report-header">
        <h1>🩺 Stellar Anchor Doctor</h1>
        <p class="audit-domain">Audit Report for <strong>${escapeHtml(report.domain)}</strong></p>
        <p class="meta">Timestamp: ${escapeHtml(report.timestamp)} · Duration: ${report.durationMs}ms</p>
      </header>

      <section class="score-card" aria-label="Health score">
        <div class="score-row">
          <span class="score-value">${report.score}</span>
          <span class="score-max">/ 100</span>
          <span class="score-grade grade-${tone}">Grade ${escapeHtml(report.grade)}</span>
        </div>
        <progress class="score-bar" max="100" value="${report.score}" aria-label="${report.score} out of 100 health score">${report.score} out of 100</progress>
        <ul class="summary-strip">
          <li class="stat stat-pass"><span class="stat-icon" aria-hidden="true">✔</span><span class="stat-label">Passed</span><span class="stat-count">${summary.pass}</span></li>
          <li class="stat stat-error"><span class="stat-icon" aria-hidden="true">✖</span><span class="stat-label">Errors</span><span class="stat-count">${summary.error}</span></li>
          <li class="stat stat-warn"><span class="stat-icon" aria-hidden="true">⚠</span><span class="stat-label">Warnings</span><span class="stat-count">${summary.warn}</span></li>
          <li class="stat stat-info"><span class="stat-icon" aria-hidden="true">ℹ</span><span class="stat-label">Notices</span><span class="stat-count">${summary.info}</span></li>
        </ul>
      </section>
${renderEndpoints(report)}
${renderFindings(report)}
      <footer class="report-footer">
        Generated by stellar-anchor-doctor · ${summary.total} checks performed · Not a certification of funds safety
      </footer>
    </main>
  </body>
</html>`;
}
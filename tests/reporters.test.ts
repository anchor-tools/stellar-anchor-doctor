import { describe, expect, it } from 'vitest';
import { formatHtmlReport, escapeHtml } from '../src/reporters/html.js';
import { formatJsonReport } from '../src/reporters/json.js';
import { formatMarkdownReport } from '../src/reporters/markdown.js';
import { formatSarifReport, mapSeverityToSarifLevel } from '../src/reporters/sarif.js';
import { formatTextReport } from '../src/reporters/text.js';
import { AnchorReport } from '../src/types.js';

describe('Report Formatters', () => {
  const dummyReport: AnchorReport = {
    domain: 'test-anchor.org',
    timestamp: '2026-10-08T00:00:00.000Z',
    durationMs: 120,
    score: 95,
    grade: 'A+',
    findings: [
      {
        id: 'sep1-accessible',
        category: 'SEP-0001',
        severity: 'pass',
        title: 'stellar.toml Discovered',
        message: 'Successfully loaded file',
      },
      {
        id: 'sep1-cors',
        category: 'SEP-0001',
        severity: 'warn',
        title: 'CORS Warning',
        message: 'Missing header',
        remediation: 'Add header',
      },
    ],
    summary: {
      pass: 1,
      info: 0,
      warn: 1,
      error: 0,
      total: 2,
    },
    endpoints: {
      stellarTomlUrl: 'https://test-anchor.org/.well-known/stellar.toml',
    },
  };

  it('formats text report cleanly', () => {
    const text = formatTextReport(dummyReport, false);
    expect(text).toContain('Stellar Anchor Doctor');
    expect(text).toContain('test-anchor.org');
    expect(text).toContain('Overall Health Score: 95/100');
    expect(text).toContain('CORS Warning');
  });

  it('quiet text output keeps warnings and the summary but hides passing findings', () => {
    const reportWithError: AnchorReport = {
      ...dummyReport,
      score: 80,
      grade: 'C',
      findings: [
        ...dummyReport.findings,
        {
          id: 'sep1-syntax',
          category: 'SEP-0001',
          severity: 'error',
          title: 'Invalid TOML Syntax',
          message: 'Could not parse stellar.toml',
        },
      ],
      summary: { pass: 1, info: 0, warn: 1, error: 1, total: 3 },
    };
    const text = formatTextReport(reportWithError, false, true);

    expect(text).not.toContain('stellar.toml Discovered');
    expect(text).toContain('CORS Warning');
    expect(text).toContain('Invalid TOML Syntax');
    expect(text).toContain('Overall Health Score: 80/100');
  });

  it('disables ANSI color codes when requested', () => {
    const text = formatTextReport(dummyReport, false);

    expect(text).not.toMatch(/\u001b\[/);
  });

  it('formats JSON report accurately', () => {
    const jsonStr = formatJsonReport(dummyReport);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.domain).toBe('test-anchor.org');
    expect(parsed.score).toBe(95);
    expect(parsed.grade).toBe('A+');
  });

  it('formats Markdown report with tables and badges', () => {
    const md = formatMarkdownReport(dummyReport);
    expect(md).toContain('# 🩺 Stellar Anchor Doctor Report: test-anchor.org');
    expect(md).toContain('Health Score: **95/100**');
    expect(md).toContain('| ✅ Passed | 1 |');
    expect(md).toContain('### [SEP-0001] ⚠️ WARN: CORS Warning');
  });

  it('formats a standalone HTML document with report content', () => {
    const html = formatHtmlReport(dummyReport);
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('Stellar Anchor Doctor');
    expect(html).toContain('test-anchor.org');
    expect(html).toContain('>95<');
    expect(html).toContain('Grade A+');
    expect(html).toContain('stellar.toml Discovered');
    expect(html).toContain('CORS Warning');
    expect(html).toContain('Missing header');
    expect(html).toContain('Remediation:</span> Add header');
    expect(html).toContain('https://test-anchor.org/.well-known/stellar.toml');
    expect(html).toContain('SEP-0001');
  });

  it('distinguishes pass, warning, and error states accessibly without color alone', () => {
    const html = formatHtmlReport(dummyReport);
    expect(html).toContain('<span class="badge badge-pass" role="status">✔ PASS</span>');
    expect(html).toContain('<span class="badge badge-warn" role="status">⚠ WARNING</span>');
    expect(html).toContain('class="finding severity-pass"');
    expect(html).toContain('class="finding severity-warn"');
    expect(html).toContain('<progress class="score-bar" max="100" value="95"');

    // Severity must remain readable even when the stylesheet is removed.
    const unstyled = html.replace(/<style>[\s\S]*<\/style>/, '');
    expect(unstyled).toContain('PASS');
    expect(unstyled).toContain('WARNING');
  });

  it('renders a report with representative error and info findings', () => {
    const representativeReport: AnchorReport = {
      ...dummyReport,
      grade: 'C',
      score: 60,
      findings: [
        ...dummyReport.findings,
        {
          id: 'sep10-timebounds',
          category: 'SEP-0010',
          severity: 'error',
          title: 'Timebounds Too Long',
          message: 'Challenge timebounds exceed 300s.',
          remediation: 'Reduce the challenge window.',
          specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md',
        },
        {
          id: 'sep1-passphrase',
          category: 'SEP-0001',
          severity: 'info',
          title: 'Testnet Passphrase',
          message: 'Anchor targets Stellar Testnet.',
        },
      ],
      summary: { pass: 1, info: 1, warn: 1, error: 1, total: 4 },
    };
    const html = formatHtmlReport(representativeReport);

    expect(html).toContain('<span class="badge badge-error" role="status">✖ ERROR</span>');
    expect(html).toContain('<span class="badge badge-info" role="status">ℹ INFO</span>');
    expect(html).toContain('Timebounds Too Long');
    expect(html).toContain('Reduce the challenge window.');
    expect(html).toContain('sep-0010.md');
    expect(html).toContain('class="finding severity-error"');
    expect(html).toContain('class="finding severity-info"');
    expect(html).toContain('>1<');
  });

  it('escapes report-derived text so it cannot inject markup', () => {
    const maliciousReport: AnchorReport = {
      ...dummyReport,
      domain: 'anchor.<script>alert("xss")</script>.com',
      findings: [
        {
          id: 'xss',
          category: 'SECURITY',
          severity: 'error',
          title: "<img src=x onerror=alert('xss')>",
          message: '& < > " \' payload',
          remediation: "Fix <script> injection",
          specUrl: 'https://example.com/?a=1&b=2"onmouseover="x',
        },
      ],
      endpoints: { ...dummyReport.endpoints, authServerUrl: '<script>alert(2)</script>' },
    };
    const html = formatHtmlReport(maliciousReport);

    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(html).not.toContain('<script>alert(2)</script>');
    expect(html).not.toContain('<img src=x');
    // Escaping leaves the payload as inert text: the literal "<" of the payload
    // is always encoded, so it can never open a real markup tag with an attribute.
    expect(html).not.toMatch(/<(\w+)[^>]*\sonerror\s*=/i);
    expect(html).toContain('&lt;script&gt;alert');
    expect(html).toContain('&lt;img src=x');
    expect(html).toContain('&amp; &lt; &gt; &quot; &#39; payload');
  });

  it('formats a valid SARIF 2.1.0 document with required fields', () => {
    const sarif = JSON.parse(formatSarifReport(dummyReport));

    expect(sarif.version).toBe('2.1.0');
    expect(sarif.$schema).toContain('sarif-2.1.0');
    expect(sarif.runs).toHaveLength(1);

    const run = sarif.runs[0];
    expect(run.tool.driver.name).toBe('stellar-anchor-doctor');
    expect(run.tool.driver.informationUri).toContain('github.com/anchor-tools/stellar-anchor-doctor');
    expect(Array.isArray(run.tool.driver.rules)).toBe(true);
    expect(Array.isArray(run.results)).toBe(true);
  });

  it('maps severities to SARIF levels and omits passing checks', () => {
    expect(mapSeverityToSarifLevel('error')).toBe('error');
    expect(mapSeverityToSarifLevel('warn')).toBe('warning');
    expect(mapSeverityToSarifLevel('info')).toBe('note');
    expect(mapSeverityToSarifLevel('pass')).toBeUndefined();

    const report: AnchorReport = {
      ...dummyReport,
      findings: [
        {
          id: 'sep1-pass',
          category: 'SEP-0001',
          severity: 'pass',
          title: 'Passing Check',
          message: 'Everything is fine.',
        },
        {
          id: 'sep1-error',
          category: 'SEP-0001',
          severity: 'error',
          title: 'Broken Endpoint',
          message: 'The endpoint failed.',
          remediation: 'Fix the endpoint.',
          specUrl: 'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md',
        },
        {
          id: 'sep24-warn',
          category: 'SEP-0024',
          severity: 'warn',
          title: 'Deprecated Field',
          message: 'A deprecated field is present.',
        },
        {
          id: 'sep10-info',
          category: 'SEP-0010',
          severity: 'info',
          title: 'Testnet Notice',
          message: 'This anchor targets Testnet.',
        },
      ],
      summary: { pass: 1, info: 1, warn: 1, error: 1, total: 4 },
    };
    const sarif = JSON.parse(formatSarifReport(report));
    const run = sarif.runs[0];

    expect(run.results).toHaveLength(3);
    expect(run.results.map((r: { level: string }) => r.level)).toEqual([
      'error',
      'warning',
      'note',
    ]);
    expect(run.results.some((r: { ruleId: string }) => r.ruleId === 'sep1-pass')).toBe(false);
    expect(run.tool.driver.rules.map((r: { id: string }) => r.id)).toEqual([
      'sep1-error',
      'sep24-warn',
      'sep10-info',
    ]);

    const errorRule = run.tool.driver.rules[0];
    expect(errorRule.defaultConfiguration.level).toBe('error');
    expect(errorRule.shortDescription.text).toBe('Broken Endpoint');
    expect(errorRule.fullDescription.text).toBe('The endpoint failed.');
    expect(errorRule.help.text).toBe('Fix the endpoint.');
    expect(errorRule.helpUri).toContain('sep-0001.md');
    expect(errorRule.properties.category).toBe('SEP-0001');

    const errorResult = run.results[0];
    expect(errorResult.ruleId).toBe('sep1-error');
    expect(errorResult.ruleIndex).toBe(0);
    expect(errorResult.message.text).toContain('Broken Endpoint');
    expect(errorResult.locations[0].physicalLocation.artifactLocation.uri).toBe(
      dummyReport.endpoints.stellarTomlUrl
    );
  });

  it('produces a self-contained document without external resources', () => {
    const html = formatHtmlReport(dummyReport);
    expect(html).not.toContain('<link');
    expect(html).not.toContain('<script src=');
    expect(html).not.toContain('@import');
    expect(html).not.toContain('<img');
  });

  it('escapes HTML metacharacters in arbitrary strings', () => {
    expect(escapeHtml(`<a href="x">'&`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
    expect(escapeHtml('plain text')).toBe('plain text');
  });
});

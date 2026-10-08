import { describe, expect, it } from 'vitest';
import { formatJsonReport } from '../src/reporters/json.js';
import { formatMarkdownReport } from '../src/reporters/markdown.js';
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
});

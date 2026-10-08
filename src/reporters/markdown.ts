import { AnchorReport } from '../types.js';

export function formatMarkdownReport(report: AnchorReport): string {
  const lines: string[] = [];

  lines.push(`# 🩺 Stellar Anchor Doctor Report: ${report.domain}`);
  lines.push(`**Date:** ${report.timestamp} | **Duration:** ${report.durationMs}ms`);
  lines.push('');
  lines.push(`### Health Score: **${report.score}/100** (Grade: **${report.grade}**)`);
  lines.push('');
  lines.push('| Status | Count |');
  lines.push('| :--- | :--- |');
  lines.push(`| ✅ Passed | ${report.summary.pass} |`);
  lines.push(`| ❌ Errors | ${report.summary.error} |`);
  lines.push(`| ⚠️ Warnings | ${report.summary.warn} |`);
  lines.push(`| ℹ️ Notices | ${report.summary.info} |`);
  lines.push('');

  lines.push('## Discovered Endpoints');
  lines.push('| Service | URL |');
  lines.push('| :--- | :--- |');
  if (report.endpoints.stellarTomlUrl) lines.push(`| SEP-1 stellar.toml | \`${report.endpoints.stellarTomlUrl}\` |`);
  if (report.endpoints.authServerUrl) lines.push(`| SEP-10 Auth Server | \`${report.endpoints.authServerUrl}\` |`);
  if (report.endpoints.transferServerSep24Url) lines.push(`| SEP-24 Transfer Server | \`${report.endpoints.transferServerSep24Url}\` |`);
  if (report.endpoints.transferServerSep6Url) lines.push(`| SEP-6 Transfer Server | \`${report.endpoints.transferServerSep6Url}\` |`);
  if (report.endpoints.anchorQuoteServerUrl) lines.push(`| SEP-38 Quote Server | \`${report.endpoints.anchorQuoteServerUrl}\` |`);
  lines.push('');

  lines.push('## Diagnostic Findings');
  lines.push('');

  for (const f of report.findings) {
    let badge = '✅ PASS';
    if (f.severity === 'error') badge = '❌ ERROR';
    else if (f.severity === 'warn') badge = '⚠️ WARN';
    else if (f.severity === 'info') badge = 'ℹ️ INFO';

    lines.push(`### [${f.category}] ${badge}: ${f.title}`);
    lines.push(`> ${f.message}`);
    if (f.remediation) {
      lines.push(`- **Remediation:** ${f.remediation}`);
    }
    if (f.specUrl) {
      lines.push(`- **Specification:** [SEP Documentation](${f.specUrl})`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

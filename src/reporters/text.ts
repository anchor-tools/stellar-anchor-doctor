import pc from 'picocolors';
import { AnchorReport, CheckCategory, DiagnosticFinding, Grade } from '../types.js';

function formatGrade(grade: Grade): string {
  switch (grade) {
    case 'A+':
    case 'A':
      return pc.bold(pc.green(grade));
    case 'B':
      return pc.bold(pc.cyan(grade));
    case 'C':
      return pc.bold(pc.yellow(grade));
    default:
      return pc.bold(pc.red(grade));
  }
}

export function formatTextReport(report: AnchorReport, useColor: boolean = true): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(pc.bold(`🩺 Stellar Anchor Doctor — Audit Report for ${pc.underline(report.domain)}`));
  lines.push(pc.dim(`Timestamp: ${report.timestamp} | Duration: ${report.durationMs}ms`));
  lines.push('');

  // Group findings by category
  const categories: CheckCategory[] = [
    'SEP-0001',
    'SEP-0010',
    'SEP-0024',
    'SEP-0038',
    'SEP-0006',
    'SECURITY',
  ];

  const grouped = new Map<CheckCategory, DiagnosticFinding[]>();
  for (const cat of categories) {
    grouped.set(cat, []);
  }

  for (const finding of report.findings) {
    const list = grouped.get(finding.category) || [];
    list.push(finding);
    grouped.set(finding.category, list);
  }

  for (const [category, findings] of grouped.entries()) {
    if (findings.length === 0) continue;

    lines.push(pc.bold(pc.magenta(`[${category}]`)));

    for (const f of findings) {
      let icon = '';
      let title = '';

      switch (f.severity) {
        case 'pass':
          icon = pc.green('✔');
          title = pc.green(f.title);
          break;
        case 'info':
          icon = pc.cyan('ℹ');
          title = pc.cyan(f.title);
          break;
        case 'warn':
          icon = pc.yellow('⚠');
          title = pc.yellow(f.title);
          break;
        case 'error':
          icon = pc.red('✖');
          title = pc.bold(pc.red(f.title));
          break;
      }

      lines.push(`  ${icon} ${title}: ${f.message}`);

      if (f.remediation) {
        lines.push(`    ${pc.dim('↳')} ${pc.dim('Remediation:')} ${pc.italic(f.remediation)}`);
      }
      if (f.specUrl && f.severity === 'error') {
        lines.push(`    ${pc.dim('↳')} ${pc.dim('Spec:')} ${pc.underline(pc.dim(f.specUrl))}`);
      }
    }
    lines.push('');
  }

  // Summary footer
  lines.push(pc.bold('─'.repeat(64)));
  lines.push(
    `Overall Health Score: ${pc.bold(`${report.score}/100`)} [Grade: ${formatGrade(report.grade)}]`
  );
  lines.push(
    `Summary: ${pc.green(`${report.summary.pass} passed`)}, ` +
      `${pc.red(`${report.summary.error} errors`)}, ` +
      `${pc.yellow(`${report.summary.warn} warnings`)}, ` +
      `${pc.cyan(`${report.summary.info} notices`)} ` +
      pc.dim(`(${report.summary.total} total checks)`)
  );
  lines.push(pc.bold('─'.repeat(64)));

  return lines.join('\n');
}

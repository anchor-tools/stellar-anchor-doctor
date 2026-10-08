import pc from 'picocolors';
import { AnchorReport, CheckCategory, DiagnosticFinding, Grade } from '../types.js';

function formatGrade(grade: Grade, color: ReturnType<typeof pc.createColors>): string {
  switch (grade) {
    case 'A+':
    case 'A':
      return color.bold(color.green(grade));
    case 'B':
      return color.bold(color.cyan(grade));
    case 'C':
      return color.bold(color.yellow(grade));
    default:
      return color.bold(color.red(grade));
  }
}

export function formatTextReport(
  report: AnchorReport,
  useColor: boolean = true,
  quiet: boolean = false
): string {
  const lines: string[] = [];
  const color = pc.createColors(useColor);

  lines.push('');
  lines.push(
    color.bold(`🩺 Stellar Anchor Doctor — Audit Report for ${color.underline(report.domain)}`)
  );
  lines.push(color.dim(`Timestamp: ${report.timestamp} | Duration: ${report.durationMs}ms`));
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

  const visibleFindings = quiet
    ? report.findings.filter((finding) => finding.severity === 'warn' || finding.severity === 'error')
    : report.findings;

  for (const finding of visibleFindings) {
    const list = grouped.get(finding.category) || [];
    list.push(finding);
    grouped.set(finding.category, list);
  }

  for (const [category, findings] of grouped.entries()) {
    if (findings.length === 0) continue;

    lines.push(color.bold(color.magenta(`[${category}]`)));

    for (const f of findings) {
      let icon = '';
      let title = '';

      switch (f.severity) {
        case 'pass':
          icon = color.green('✔');
          title = color.green(f.title);
          break;
        case 'info':
          icon = color.cyan('ℹ');
          title = color.cyan(f.title);
          break;
        case 'warn':
          icon = color.yellow('⚠');
          title = color.yellow(f.title);
          break;
        case 'error':
          icon = color.red('✖');
          title = color.bold(color.red(f.title));
          break;
      }

      lines.push(`  ${icon} ${title}: ${f.message}`);

      if (f.remediation) {
        lines.push(
          `    ${color.dim('↳')} ${color.dim('Remediation:')} ${color.italic(f.remediation)}`
        );
      }
      if (f.specUrl && f.severity === 'error') {
        lines.push(
          `    ${color.dim('↳')} ${color.dim('Spec:')} ${color.underline(color.dim(f.specUrl))}`
        );
      }
    }
    lines.push('');
  }

  // Summary footer
  lines.push(color.bold('─'.repeat(64)));
  lines.push(
    `Overall Health Score: ${color.bold(`${report.score}/100`)} [Grade: ${formatGrade(report.grade, color)}]`
  );
  lines.push(
    `Summary: ${color.green(`${report.summary.pass} passed`)}, ` +
      `${color.red(`${report.summary.error} errors`)}, ` +
      `${color.yellow(`${report.summary.warn} warnings`)}, ` +
      `${color.cyan(`${report.summary.info} notices`)} ` +
      color.dim(`(${report.summary.total} total checks)`)
  );
  lines.push(color.bold('─'.repeat(64)));

  return lines.join('\n');
}

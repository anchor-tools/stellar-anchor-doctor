import { defaultRegistry } from './checks/registry.js';
import {
  AnchorReport,
  CheckContext,
  DiagnosticFinding,
  DiagnosticSummary,
  DoctorOptions,
  Grade,
} from './types.js';
import { normalizeDomain } from './utils/http.js';

export function calculateGrade(score: number): Grade {
  if (score >= 95) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

export function calculateScore(summary: DiagnosticSummary): number {
  let score = 100;
  score -= summary.error * 15;
  score -= summary.warn * 5;
  return Math.max(0, Math.min(100, score));
}

export class DoctorEngine {
  constructor(private registry = defaultRegistry) {}

  public async runAudit(options: DoctorOptions): Promise<AnchorReport> {
    const startTime = Date.now();
    const cleanDomain = normalizeDomain(options.domain);

    const context: CheckContext = {
      domain: cleanDomain,
      isTestnet: options.testnet ?? false,
      timeoutMs: options.timeout ?? 8000,
      skipChecks: options.skip ?? [],
      endpoints: {},
      fetchFn: options.fetchFn,
    };

    const allFindings: DiagnosticFinding[] = [];

    // Always run SEP-1 first to discover endpoints
    const sep1 = this.registry.get('sep-1');
    if (sep1 && !context.skipChecks.includes('sep-1')) {
      const sep1Findings = await sep1.run(context);
      allFindings.push(...sep1Findings);
    }

    // Run the remaining checks in sequence
    const remainingChecks = this.registry
      .getAll()
      .filter((c) => c.id !== 'sep-1' && !context.skipChecks.includes(c.id));

    for (const check of remainingChecks) {
      try {
        const findings = await check.run(context);
        allFindings.push(...findings);
      } catch (err: any) {
        allFindings.push({
          id: `${check.id}-unhandled-error`,
          category: check.category,
          severity: 'error',
          title: `Diagnostic Check Error (${check.name})`,
          message: `Unexpected error running check: ${err.message}`,
        });
      }
    }

    const summary: DiagnosticSummary = {
      pass: 0,
      info: 0,
      warn: 0,
      error: 0,
      total: allFindings.length,
    };

    for (const f of allFindings) {
      if (f.severity === 'pass') summary.pass++;
      else if (f.severity === 'info') summary.info++;
      else if (f.severity === 'warn') summary.warn++;
      else if (f.severity === 'error') summary.error++;
    }

    const score = calculateScore(summary);
    const grade = calculateGrade(score);
    const durationMs = Date.now() - startTime;

    return {
      domain: cleanDomain,
      timestamp: new Date().toISOString(),
      durationMs,
      score,
      grade,
      findings: allFindings,
      summary,
      endpoints: context.endpoints,
    };
  }
}

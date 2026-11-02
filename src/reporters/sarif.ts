import { AnchorReport, DiagnosticFinding } from '../types.js';

export const SARIF_VERSION = '2.1.0';
export const SARIF_SCHEMA = 'https://json.schemastore.org/sarif-2.1.0.json';

const TOOL_NAME = 'stellar-anchor-doctor';
const TOOL_VERSION = '1.0.0';
const TOOL_INFORMATION_URI = 'https://github.com/anchor-tools/stellar-anchor-doctor';

type SarifLevel = 'error' | 'warning' | 'note';

/**
 * Map a diagnostic severity to a SARIF result level.
 * Passing checks are not findings and therefore map to `undefined`.
 */
export function mapSeverityToSarifLevel(severity: DiagnosticFinding['severity']): SarifLevel | undefined {
  switch (severity) {
    case 'error':
      return 'error';
    case 'warn':
      return 'warning';
    case 'info':
      return 'note';
    case 'pass':
      return undefined;
  }
}

function findingUri(report: AnchorReport): string {
  return report.endpoints.stellarTomlUrl ?? `https://${report.domain}/.well-known/stellar.toml`;
}

function toRule(finding: DiagnosticFinding, level: SarifLevel) {
  return {
    id: finding.id,
    name: finding.id,
    shortDescription: { text: finding.title },
    fullDescription: { text: finding.message },
    ...(finding.remediation ? { help: { text: finding.remediation } } : {}),
    ...(finding.specUrl ? { helpUri: finding.specUrl } : {}),
    defaultConfiguration: { level },
    properties: {
      category: finding.category,
      severity: finding.severity,
    },
  };
}

function toResult(finding: DiagnosticFinding, level: SarifLevel, ruleIndex: number, uri: string) {
  return {
    ruleId: finding.id,
    ruleIndex,
    level,
    message: { text: `${finding.title}: ${finding.message}` },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri },
          region: { startLine: 1, startColumn: 1 },
        },
      },
    ],
    properties: {
      category: finding.category,
      severity: finding.severity,
    },
  };
}

/**
 * Produce a SARIF 2.1.0 document for GitHub code scanning and other
 * SARIF-consuming tools. Passing checks are excluded from `results`.
 */
export function formatSarifReport(report: AnchorReport): string {
  const uri = findingUri(report);
  const rules: ReturnType<typeof toRule>[] = [];
  const results: ReturnType<typeof toResult>[] = [];
  const ruleIndexes = new Map<string, number>();

  for (const finding of report.findings) {
    const level = mapSeverityToSarifLevel(finding.severity);
    if (!level) continue;

    let ruleIndex = ruleIndexes.get(finding.id);
    if (ruleIndex === undefined) {
      ruleIndex = rules.length;
      ruleIndexes.set(finding.id, ruleIndex);
      rules.push(toRule(finding, level));
    }

    results.push(toResult(finding, level, ruleIndex, uri));
  }

  const sarif = {
    $schema: SARIF_SCHEMA,
    version: SARIF_VERSION,
    runs: [
      {
        tool: {
          driver: {
            name: TOOL_NAME,
            version: TOOL_VERSION,
            informationUri: TOOL_INFORMATION_URI,
            rules,
          },
        },
        results,
        properties: {
          domain: report.domain,
          timestamp: report.timestamp,
          score: report.score,
          grade: report.grade,
        },
      },
    ],
  };

  return JSON.stringify(sarif, null, 2);
}

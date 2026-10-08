import { AnchorReport } from '../types.js';

export function formatJsonReport(report: AnchorReport): string {
  return JSON.stringify(report, null, 2);
}

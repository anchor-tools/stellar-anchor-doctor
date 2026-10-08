export type Severity = 'pass' | 'info' | 'warn' | 'error';

export type CheckCategory =
  | 'SEP-0001'
  | 'SEP-0010'
  | 'SEP-0024'
  | 'SEP-0038'
  | 'SEP-0006'
  | 'SECURITY'
  | 'NETWORK';

export type Grade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface DiagnosticFinding {
  id: string;
  category: CheckCategory;
  severity: Severity;
  title: string;
  message: string;
  specUrl?: string;
  remediation?: string;
  details?: Record<string, unknown>;
}

export interface DiscoveredEndpoints {
  stellarTomlUrl?: string;
  authServerUrl?: string;
  transferServerSep24Url?: string;
  transferServerSep6Url?: string;
  anchorQuoteServerUrl?: string;
  kycServerUrl?: string;
  directPaymentServerUrl?: string;
  signingKey?: string;
  networkPassphrase?: string;
}

export interface CheckContext {
  domain: string;
  isTestnet: boolean;
  timeoutMs: number;
  skipChecks: string[];
  endpoints: DiscoveredEndpoints;
  tomlData?: Record<string, any>;
  fetchFn?: typeof fetch;
}

export interface DiagnosticCheck {
  id: string;
  name: string;
  category: CheckCategory;
  description: string;
  specUrl: string;
  run(context: CheckContext): Promise<DiagnosticFinding[]>;
}

export interface DiagnosticSummary {
  pass: number;
  info: number;
  warn: number;
  error: number;
  total: number;
}

export interface AnchorReport {
  domain: string;
  timestamp: string;
  durationMs: number;
  score: number;
  grade: Grade;
  findings: DiagnosticFinding[];
  summary: DiagnosticSummary;
  endpoints: DiscoveredEndpoints;
}

export interface DoctorOptions {
  domain: string;
  format?: 'text' | 'json' | 'markdown';
  strict?: boolean;
  skip?: string[];
  timeout?: number;
  testnet?: boolean;
  quiet?: boolean;
  color?: boolean;
  fetchFn?: typeof fetch;
}

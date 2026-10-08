import { DiagnosticCheck } from '../types.js';
import { sep1Check } from './sep1.js';
import { sep10Check } from './sep10.js';
import { sep24Check } from './sep24.js';
import { sep38Check } from './sep38.js';
import { sep6Check } from './sep6.js';
import { securityCheck } from './security.js';

export class CheckRegistry {
  private checks: Map<string, DiagnosticCheck> = new Map();

  constructor() {
    this.register(sep1Check);
    this.register(sep10Check);
    this.register(sep24Check);
    this.register(sep38Check);
    this.register(sep6Check);
    this.register(securityCheck);
  }

  public register(check: DiagnosticCheck): void {
    this.checks.set(check.id, check);
  }

  public get(id: string): DiagnosticCheck | undefined {
    return this.checks.get(id);
  }

  public getAll(): DiagnosticCheck[] {
    return Array.from(this.checks.values());
  }

  public getByIds(ids: string[]): DiagnosticCheck[] {
    return ids
      .map((id) => this.checks.get(id))
      .filter((check): check is DiagnosticCheck => check !== undefined);
  }
}

export const defaultRegistry = new CheckRegistry();
